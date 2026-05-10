import i18n from 'i18next';
import { AIService } from './AIService';
import { ContextBuilder, ResponseFormatter } from './PromptUtils';
import { ActionEnvelope } from './actions/ActionEnvelope';
import { ActionValidator } from './actions/ActionValidator';
import { ActionExecutor } from './actions/ActionExecutor';
import { WorkflowRouter } from './workflows/WorkflowRouter';
import { PolicyContext } from './policy/PolicyContext';
import { TaskRepository } from '../TaskRepository';
import { NotificationService } from '../notifications/NotificationService';
import { AppLogger } from '../iot/AppLogger';
import { WeatherService } from '../external/WeatherService';
import { DataAggregator } from '../iot/DataAggregator';
import { useUserSessionStore } from '../../store';
import { LanguageService } from '../LanguageService';
import { GuardrailsService } from './GuardrailsService';
import { AIAuditService } from './AIAuditService';

const safeT = (key) => {
  const out = i18n.t(key);
  return typeof out === 'string' && out.trim() ? out : key;
};

const AGENT_PROMPTS = {
  crop: 'You are an Agronomist Agent for farmers. Provide actionable, detailed, and highly definite agronomy advice using the farm context. You MUST specify exact product or brand names, mixing dosages such as kg/acre or ml/L, and precise methodologies instead of generic advice.',
  market: 'You are a Market and Finance Agent. Provide crop pricing trends and economic advice based on the supplied market prices.',
  general: 'You are the AgroCompanion Orchestrator. Help the farmer with general queries.',
};

const ACTION_PATTERNS = {
  create: ['add a task', 'schedule', 'remind me', 'create a plan', 'set a reminder', 'plan for', 'add to my list', 'book', 'create task', 'new task', 'generate task'],
  update: ['reschedule', 'reorganise', 'reorganize', 'change the date', 'move task', 'push back', 'adjust dates', 'shift by', 'start from', 'update task', 'rename', 'postpone', 'delay', 'edit task', 'modify task', 'change task'],
  delete: ['delete task', 'remove task', 'cancel task', 'clear task', 'delete it', 'remove it', 'cancel it', 'drop task'],
};

const toDateKey = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const summarizeForecast = (forecast) => {
  const list = Array.isArray(forecast?.list) ? forecast.list : [];
  if (list.length === 0) {
    return 'No forecast data available.';
  }

  const days = {};
  for (const item of list) {
    const key = toDateKey(item?.dt_txt || (typeof item?.dt === 'number' ? item.dt * 1000 : null));
    if (!key) continue;
    const temp = Number(item?.main?.temp);
    const humidity = Number(item?.main?.humidity);
    const wind = Number(item?.wind?.speed);
    const rain = Number(item?.rain?.['3h'] || 0);

    if (!days[key]) {
      days[key] = {
        minTemp: Number.isFinite(temp) ? temp : null,
        maxTemp: Number.isFinite(temp) ? temp : null,
        maxWind: Number.isFinite(wind) ? wind : 0,
        maxHumidity: Number.isFinite(humidity) ? humidity : 0,
        rainMm: Number.isFinite(rain) ? rain : 0,
      };
    } else {
      if (Number.isFinite(temp)) {
        days[key].minTemp = days[key].minTemp === null ? temp : Math.min(days[key].minTemp, temp);
        days[key].maxTemp = days[key].maxTemp === null ? temp : Math.max(days[key].maxTemp, temp);
      }
      if (Number.isFinite(wind)) {
        days[key].maxWind = Math.max(days[key].maxWind, wind);
      }
      if (Number.isFinite(humidity)) {
        days[key].maxHumidity = Math.max(days[key].maxHumidity, humidity);
      }
      if (Number.isFinite(rain)) {
        days[key].rainMm += rain;
      }
    }
  }

  const keys = Object.keys(days).sort().slice(0, 5);
  return keys.map(key => {
    const day = days[key];
    const tempRange = day.minTemp === null || day.maxTemp === null ? 'temp N/A' : `${Math.round(day.minTemp)}-${Math.round(day.maxTemp)}C`;
    const rainLabel = `${Math.round(day.rainMm * 10) / 10}mm rain`;
    const windLabel = `${Math.round(day.maxWind * 10) / 10}m/s wind`;
    const humidityLabel = `${Math.round(day.maxHumidity)}% humidity`;
    return `${key}: ${tempRange}, ${rainLabel}, ${windLabel}, ${humidityLabel}`;
  }).join('\n');
};

const buildActionScanText = (envelope) => {
  const actions = Array.isArray(envelope?.actions) ? envelope.actions : [];
  const lines = actions.map(a => {
    if (!a || typeof a !== 'object') return '';
    if (a.type === 'create_task') {
      return `create_task: ${a.title || ''} | ${a.date || ''} | ${a.priority || ''} | ${a.description || ''}`;
    }
    if (a.type === 'update_task') {
      return `update_task: ${a.task_id || a.taskId || ''} | ${(a.patch && JSON.stringify(a.patch)) || ''}`;
    }
    if (a.type === 'delete_task') {
      return `delete_task: ${a.task_id || a.taskId || ''}`;
    }
    return '';
  }).filter(Boolean);
  return `${envelope?.message || ''}\n${lines.join('\n')}`.trim();
};

const formatForUser = ({ message, execResults }) => {
  const parts = [];
  const m = (message || '').toString().trim();
  if (m) parts.push(m);

  const created = Array.isArray(execResults?.created) ? execResults.created : [];
  const updated = Array.isArray(execResults?.updated) ? execResults.updated : [];
  const deleted = Array.isArray(execResults?.deleted) ? execResults.deleted : [];
  const rejected = Array.isArray(execResults?.rejected) ? execResults.rejected : [];

  const lines = [];
  for (const c of created) {
    const t = c?.task;
    if (t?.title && t?.date) lines.push(`- Task added: ${t.title} (${t.date})`);
  }
  for (const u of updated) {
    if (u?.taskId) lines.push(`- Task updated: ${u.taskId}`);
  }
  for (const d of deleted) {
    if (d?.taskId) lines.push(`- Task deleted: ${d.taskId}`);
  }
  for (const r of rejected) {
    if (r?.type) lines.push(`- Action skipped (${r.type}): ${r.reason || 'rejected'}`);
  }

  if (lines.length > 0) {
    parts.push(lines.join('\n'));
  }

  return parts.join('\n\n').trim();
};

const getSensorSnapshot = async () => {
  const keys = [
    'temperature',
    'humidity',
    'pressure',
    'soil_moisture',
    'soil_ph',
    'nitrogen',
    'phosphorus',
    'potassium',
    'light_lux',
    'is_raining',
  ];

  const snapshot = {};
  for (const key of keys) {
    const v = await DataAggregator.getOfflineValue(key);
    if (v === null || typeof v === 'undefined' || Number.isNaN(Number(v))) {
      snapshot[key] = null;
      continue;
    }
    snapshot[key] = Number(v);
  }
  snapshot.capturedAt = new Date().toISOString();
  return snapshot;
};

const detectTaskIntent = (userPrompt) => {
  const text = (userPrompt || '').toLowerCase();
  
  const createRegex = /\b(add|create|schedule|generate|plan)\b.*\btask(s)?\b|\b(remind me|set a reminder|plan for|add to my list|book)\b|\bnew task\b|\bschedule\b/;
  const create = createRegex.test(text) || ACTION_PATTERNS.create.some(pattern => text.includes(pattern));
  
  const updateRegex = /\b(update|edit|modify|change|move|shift)\b.*\btask(s)?\b|\b(reschedule|reorganise|reorganize|postpone|delay|push back|adjust dates|rename)\b/;
  const update = updateRegex.test(text) || ACTION_PATTERNS.update.some(pattern => text.includes(pattern));
  
  const deleteRegex = /\b(delete|remove|cancel|clear|drop)\b.*\btask(s)?\b|\bcancel\b/;
  const del = deleteRegex.test(text) || ACTION_PATTERNS.delete.some(pattern => text.includes(pattern));

  return {
    create,
    update,
    delete: del,
    any: create || update || del,
  };
};

const formatSensorSnapshot = (sensorSnapshot) => {
  if (!sensorSnapshot || typeof sensorSnapshot !== 'object') {
    return 'N/A';
  }
  const entries = Object.entries(sensorSnapshot)
    .filter(([key, value]) => key !== 'capturedAt' && value !== null && typeof value !== 'undefined')
    .map(([key, value]) => `${key}: ${value}`);
  if (sensorSnapshot.capturedAt) {
    entries.push(`capturedAt: ${sensorSnapshot.capturedAt}`);
  }
  return entries.length > 0 ? entries.join('\n') : 'N/A';
};

const buildTaskContext = (activeTasks = [], actionIntent) => {
  if (!Array.isArray(activeTasks) || activeTasks.length === 0) {
    return 'Active pending tasks:\nNone';
  }
  const lines = activeTasks
    .slice(0, 12)
    .map(t => `ID: ${t.id} | Source: ${t.source || 'manual'} | Title: ${t.title} | Date: ${t.date} | Priority: ${t.priority}`)
    .join('\n');
  return `Active pending tasks:\n${lines}`;
};

const buildTaskPolicy = (actionIntent) => {
  if (!actionIntent?.any) {
    return [
      'Task policy:',
      '- Set actions to [].',
      '- Do not create, update, or delete tasks unless the user explicitly asks.',
    ].join('\n');
  }

  const lines = [
    'Task policy:',
    '- Only use actions the user explicitly requested.',
    '- If the request is ambiguous, set actions to [].',
  ];
  if (actionIntent.create) {
    lines.push('- create_task is allowed for explicit scheduling or reminder requests.');
  }
  if (actionIntent.update) {
    lines.push('- update_task is allowed for explicit rename, reschedule, or shift requests.');
  }
  if (actionIntent.delete) {
    lines.push('- delete_task is allowed for explicit remove or cancel requests.');
  }
  return lines.join('\n');
};

const getAllowedActionTypes = (actionIntent) => {
  if (!actionIntent?.any) return [];
  const allowed = [];
  if (actionIntent.create) allowed.push('create_task');
  if (actionIntent.update) allowed.push('update_task');
  if (actionIntent.delete) allowed.push('delete_task');
  return allowed;
};

const buildSystemPrompt = ({ intent, jurisdiction, regionalPromptBlock, context, sensorSnapshot, forecastSummary, taskContext, marketPricesSummary = '', actionIntent }) => {
  const base = AGENT_PROMPTS[intent] || AGENT_PROMPTS.general;
  return `${base}
Jurisdiction: ${jurisdiction}
${regionalPromptBlock ? `${regionalPromptBlock}\n` : ''}Policy constraints:
- You MUST provide highly detailed, definite instructional descriptions for every task.
- When recommending fertilizers or pesticides, provide specific product or brand names along with exact dosages and mixing quantities.
- For physical tasks like soil prep or ploughing, specify the exact methods, depths, and parameters.
- NEVER ask the user clarifying questions. You have full context. Make reasonable assumptions if data is missing.
- CRITICAL GUARDRAIL: Never allow deletion of foundational tasks like sowing, planting, transplanting, or harvesting.
- CRITICAL GUARDRAIL: Cross-check crop identity. Refuse tasks if issue is incompatible with crop.
- CRITICAL GUARDRAIL: Cross-check crop age. Refuse treatments for stages that have not occurred yet.
- CRITICAL GUARDRAIL: Never recommend spraying if forecast shows heavy rain or high wind.
- CRITICAL GUARDRAIL: Never recommend irrigation if soil moisture is very high or flooded.
- CRITICAL GUARDRAIL: Prevent duplicate tasks by checking Active Pending Tasks first.
- CRITICAL TOOL POLICY: If you need data (like specific future market prices, weather forecasts, or inventory details) to answer accurately, DO NOT guess or assume existing data. You MUST call the appropriate tool function to fetch the actual value.
- CRITICAL TASK POLICY: When using update_task, ONLY include the specific fields in the patch object that the user explicitly asked to change. NEVER overwrite or include the 'description', 'title', or 'priority' fields if the user only asked to change the date.
${ActionEnvelope.formatForModel({
  allowedActionTypes: getAllowedActionTypes(actionIntent),
  messagePlaceholder: 'Detailed answer for the farmer.',
})}
${buildTaskPolicy(actionIntent)}

Farm Context:
${context}

Sensor Snapshot:
${formatSensorSnapshot(sensorSnapshot)}

5-Day Weather Forecast Summary:
${forecastSummary}

${marketPricesSummary ? `Market Prices Summary:\n${marketPricesSummary}\n` : ''}${taskContext ? `${taskContext}\n` : ''}`;
};

const buildWorkflowNarrationPrompt = ({ intent, jurisdiction, regionalPromptBlock, context, sensorSnapshot, forecastSummary, workflowFacts, workflowHint }) => {
  const base = AGENT_PROMPTS[intent] || AGENT_PROMPTS.general;
  return `${base}
Jurisdiction: ${jurisdiction}
${regionalPromptBlock ? `${regionalPromptBlock}\n` : ''}Policy constraints:
- You MUST provide highly detailed, definite conversational descriptions.
- When recommending fertilizers or pesticides, provide specific product or brand names along with exact dosages and mixing quantities.
- For physical tasks, specify the exact methods, depths, and parameters.
- NEVER ask the user clarifying questions. You have full context. Make reasonable assumptions if data is missing.
- CRITICAL GUARDRAIL: Never allow deletion of foundational tasks like sowing, planting, transplanting, or harvesting.
- CRITICAL GUARDRAIL: Cross-check crop identity. Refuse tasks if issue is incompatible with crop.
- CRITICAL GUARDRAIL: Cross-check crop age. Refuse treatments for stages that have not occurred yet.
- CRITICAL GUARDRAIL: Never recommend spraying if forecast shows heavy rain or high wind.
- CRITICAL GUARDRAIL: Never recommend irrigation if soil moisture is very high or flooded.
- CRITICAL GUARDRAIL: Prevent duplicate tasks by checking Active Pending Tasks first.
- CRITICAL TASK POLICY: When using update_task, ONLY include the specific fields in the patch object that the user explicitly asked to change. NEVER overwrite or include the 'description', 'title', or 'priority' fields if the user only asked to change the date.
${ActionEnvelope.formatForModel({
  allowedActionTypes: [],
  messagePlaceholder: 'Detailed conversational reply for the farmer.',
})}
Set actions to [].

Farm Context:
${context}

Sensor Snapshot:
${formatSensorSnapshot(sensorSnapshot)}

5-Day Weather Forecast Summary:
${forecastSummary}

Workflow facts:
Use the 'get_workflow_facts' tool to fetch any active workflow facts.
Workflow hint: ${workflowHint || ''}`;
};

export const AgentOrchestrator = {
  routeQuery: async (userPrompt, intent = 'general', chatLog = []) => {
    const context = ContextBuilder.buildFarmContext({ intent });
    const languageCode = LanguageService.getCurrentLanguage() || 'en';
    const policyContext = PolicyContext.resolveContext();
    const jurisdiction = policyContext.jurisdiction;
    const regionalPromptBlock = PolicyContext.buildRegionalPromptBlock();
    const actionIntent = detectTaskIntent(userPrompt);

    const activeTasks = await TaskRepository.getAllTasks();
    const taskContext = buildTaskContext(activeTasks, actionIntent);

    const { currentFarm, currentSession } = useUserSessionStore.getState();
    const lat = Number(currentFarm?.latitude);
    const lon = Number(currentFarm?.longitude);
    let forecast = null;
    let forecastSummary = 'N/A';
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      try {
        forecast = await WeatherService.getForecast(lat, lon);
        forecastSummary = summarizeForecast(forecast);
      } catch (e) {
        console.warn('Forecast fetch failed:', e);
        forecastSummary = 'Forecast data currently unavailable.';
      }
    }

    let sensorSnapshot = null;
    try {
      sensorSnapshot = await getSensorSnapshot();
    } catch {
      sensorSnapshot = null;
    }

    let marketPricesSummary = '';
    try {
      const crop = currentSession?.cropType;
      const state = currentFarm?.stateName || currentFarm?.state || '';
      const district = currentFarm?.districtName || '';
      const { MarketDataService } = require('../market/MarketDataService');

      if (crop && intent === 'market') {
        const prices = await MarketDataService.getMandiPrices(crop, state, district);
        if (prices && prices.length > 0) {
          const maxPriceIdx = Math.max(1, Math.min(3, prices.length));
          marketPricesSummary = prices
            .slice(0, maxPriceIdx)
            .map(p => `${p.market} (${p.district}, ${p.state}): Min INR${p.min_price}, Max INR${p.max_price}, Mode INR${p.modal_price}`)
            .join('\n');
        } else {
          marketPricesSummary = `No recent market prices available for ${crop} in ${district || state || 'your area'}.`;
        }
      }
    } catch (e) {
      console.log('Market price fetch failed in agent orchestration:', e);
    }

    const pre = GuardrailsService.preCheck({
      userPrompt,
      languageCode,
      sensorSnapshot,
      forecastSummary,
      jurisdiction,
    });

    await AIAuditService.logEvent({
      type: 'assistant_query',
      intent,
      languageCode,
      userPrompt,
      sensorSnapshot,
      forecastSummary,
      guardrails: pre,
      jurisdiction,
    }).catch(() => {});

    if (!pre.ok) {
      AppLogger.publish('Guardrails', `${pre.kind}: ${(pre.tags || []).join(',')}`);
      return pre.message;
    }

    const wf = WorkflowRouter.pick(userPrompt);
    if (wf) {
      const wfResult = wf.run({ userPrompt, sensorSnapshot, forecast });
      if (!wfResult.ok) {
        if (wfResult.code === 'missing_soil') return safeT('errors:ai.missing_soil');
        if (wfResult.code === 'missing_forecast') return safeT('errors:ai.missing_forecast');
        return safeT('errors:ai.blocked_generic');
      }

      const narrativePrompt = buildWorkflowNarrationPrompt({
        intent,
        jurisdiction,
        regionalPromptBlock,
        context,
        sensorSnapshot,
        forecastSummary,
        workflowFacts: wfResult.facts || {},
        workflowHint: wfResult.narrativeHint || '',
      });

      const rawNarrative = await AIService.generateResponse(narrativePrompt, userPrompt, null, {
        expectJsonEnvelope: true,
        feature: 'assistant_workflow',
        chatLog,
      });
      const parsedNarrative = ActionEnvelope.parse(rawNarrative);
      const narrativeEnvelope = parsedNarrative.ok ? parsedNarrative.envelope : { message: safeT('errors:ai.workflow_fallback'), actions: [] };
      const narrativePost = GuardrailsService.postCheck({
        userPrompt,
        rawResponse: (narrativeEnvelope.message || '').toString(),
        languageCode,
        jurisdiction,
      });
      if (!narrativePost.ok) {
        await AIAuditService.logEvent({
          type: 'assistant_blocked_response',
          intent,
          languageCode,
          tags: narrativePost.tags || [],
          jurisdiction,
        }).catch(() => {});
        return narrativePost.message;
      }

      const finalEnvelope = { message: ResponseFormatter.format(narrativeEnvelope.message || ''), actions: wfResult.actions || [] };
      const validated = ActionValidator.validateEnvelope({
        envelope: finalEnvelope,
        context: { maxActions: 5, horizonDays: 180, strict: true, sensorSnapshot, forecastSummary, enforceTimingContext: true, activeTasks },
      });
      if (!validated.ok) {
        AppLogger.publish('Guardrails', 'action_validation_failed');
        if ((validated.errors || []).includes('missing_soil_context')) return safeT('errors:ai.missing_soil');
        if ((validated.errors || []).includes('missing_forecast_context')) return safeT('errors:ai.missing_forecast');
        return safeT('errors:ai.action_validation_failed');
      }

      const scanText = buildActionScanText(validated.envelope);
      const post = GuardrailsService.postCheck({ userPrompt, rawResponse: scanText, languageCode, jurisdiction });
      if (!post.ok) {
        await AIAuditService.logEvent({
          type: 'assistant_blocked_response',
          intent,
          languageCode,
          tags: post.tags || [],
          jurisdiction,
        }).catch(() => {});
        return post.message;
      }

      const execResults = await ActionExecutor.execute({ envelope: validated.envelope, context: { source: 'workflow' } });
      for (const c of execResults.created || []) {
        const t = c?.task;
        if (!t?.title || !t?.date) continue;
        await NotificationService.scheduleLocalNotification(
          'Task Scheduled',
          `"${t.title}" added for ${t.date}`,
          2
        ).catch(() => {});
      }

      await AIAuditService.logEvent({
        type: 'assistant_result',
        intent,
        languageCode,
        createdCount: (execResults.created || []).length,
        updatedCount: (execResults.updated || []).length,
        deletedCount: (execResults.deleted || []).length,
        workflow: wfResult.narrativeHint || '',
        jurisdiction,
      }).catch(() => {});

      return formatForUser({ message: validated.envelope.message, execResults });
    }

    const systemPrompt = buildSystemPrompt({
      intent,
      jurisdiction,
      regionalPromptBlock,
      context,
      sensorSnapshot,
      forecastSummary,
      taskContext,
      marketPricesSummary,
      actionIntent,
    });

    AppLogger.publish('AI Query', `[${intent}] ${userPrompt.slice(0, 80)}`);

    const feature = intent === 'market' ? 'assistant_market' : 'assistant_general';
    const maxCreateOrDelete = 10;
    const maxUpdateOnly = 20;
    const maxActions = actionIntent.any
      ? (actionIntent.update && !actionIntent.create && !actionIntent.delete ? maxUpdateOnly : maxCreateOrDelete)
      : 0;
    let dynamicUserPrompt = userPrompt;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const retryPrefix = attempt > 1 ? 'Previous output failed validation. Fix the JSON and keep the advice detailed.\n\n' : '';
        const finalSystemPrompt = retryPrefix + systemPrompt;

        const rawResponse = await AIService.generateResponse(finalSystemPrompt, dynamicUserPrompt, null, {
          expectJsonEnvelope: true,
          noCache: attempt > 1,
          chatLog,
          feature,
          retryAttempt: attempt,
          useTools: true,
        });
        const parsed = ActionEnvelope.parse(rawResponse);
        if (!parsed.ok) {
          throw new Error('Action format is missing or invalid JSON');
        }

        const validated = ActionValidator.validateEnvelope({
          envelope: parsed.envelope,
          context: { maxActions, horizonDays: 365, strict: true, sensorSnapshot, forecastSummary, enforceTimingContext: true, activeTasks },
        });
        if (!validated.ok) {
          if ((validated.errors || []).includes('missing_soil_context')) throw new Error('missing_soil_context');
          if ((validated.errors || []).includes('missing_forecast_context')) throw new Error('missing_forecast_context');
          throw new Error(`Validation failed: ${(validated.errors || ['bad format']).join(', ')}`);
        }

        const scanText = buildActionScanText(validated.envelope);
        const post = GuardrailsService.postCheck({ userPrompt, rawResponse: scanText, languageCode, jurisdiction });
        if (!post.ok) {
          await AIAuditService.logEvent({
            type: 'assistant_blocked_response',
            intent,
            languageCode,
            tags: post.tags || [],
            jurisdiction,
          }).catch(() => {});
          AppLogger.publish('Guardrails', `post_block: ${(post.tags || []).join(',')}`);
          throw new Error(`Policy guardrail blocked response: ${post.message}`);
        }

        const envelope = { ...validated.envelope, message: ResponseFormatter.format(validated.envelope.message || '') };
        const execResults = await ActionExecutor.execute({ envelope, context: { source: 'assistant' } });
        for (const c of execResults.created || []) {
          const t = c?.task;
          if (!t?.title || !t?.date) continue;
          await NotificationService.scheduleLocalNotification(
            'Task Scheduled',
            `"${t.title}" added for ${t.date}`,
            2
          ).catch(() => {});
        }

        await AIAuditService.logEvent({
          type: 'assistant_result',
          intent,
          languageCode,
          createdCount: (execResults.created || []).length,
          updatedCount: (execResults.updated || []).length,
          deletedCount: (execResults.deleted || []).length,
          jurisdiction,
        }).catch(() => {});

        return formatForUser({ message: envelope.message, execResults });
      } catch (e) {
        if (attempt === 3) {
          if (e.message === 'missing_soil_context') return safeT('errors:ai.missing_soil');
          if (e.message === 'missing_forecast_context') return safeT('errors:ai.missing_forecast');
          if (e.message.includes('Policy guardrail')) return e.message.replace('Policy guardrail blocked response: ', '');
          return safeT('errors:ai.action_validation_failed');
        }

        dynamicUserPrompt = `${userPrompt}\nValidation fix required: ${e.message}\nReturn corrected JSON only.`;
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    return safeT('errors:ai.action_validation_failed');
  },

  analyzeImage: async (base64Image, queryText = '', intent = 'crop') => {
    const context = ContextBuilder.buildFarmContext({ intent: 'image' });
    const languageCode = LanguageService.getCurrentLanguage() || 'en';
    const policyContext = PolicyContext.resolveContext();
    const jurisdiction = policyContext.jurisdiction;
    const regionalPromptBlock = PolicyContext.buildRegionalPromptBlock();
    const activeTasks = await TaskRepository.getAllTasks();

    const userPrompt = queryText.trim() ? queryText : 'Please diagnose the pathology in this image and provide mitigation steps.';
    const { currentFarm } = useUserSessionStore.getState();
    const lat = Number(currentFarm?.latitude);
    const lon = Number(currentFarm?.longitude);
    let forecastSummary = 'N/A';
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      try {
        const forecast = await WeatherService.getForecast(lat, lon);
        forecastSummary = summarizeForecast(forecast);
      } catch {}
    }

    const pre = GuardrailsService.preCheck({
      userPrompt,
      languageCode,
      sensorSnapshot: null,
      forecastSummary,
      jurisdiction,
    });

    await AIAuditService.logEvent({
      type: 'image_query',
      intent,
      languageCode,
      guardrails: pre,
      jurisdiction,
    }).catch(() => {});

    if (!pre.ok) {
      AppLogger.publish('Guardrails', `${pre.kind}: ${(pre.tags || []).join(',')}`);
      return pre.message;
    }

    const systemPrompt = `You are an expert Agricultural Plant Pathologist AI.
Analyze the crop image.
Jurisdiction: ${jurisdiction}
${regionalPromptBlock ? `${regionalPromptBlock}\n` : ''}Policy constraints:
- You MUST provide highly detailed, definite instructional descriptions.
- When recommending pesticide treatments, provide specific product or brand names along with exact dosages and mixing quantities.
- NEVER ask the user clarifying questions. You have full context. Make reasonable assumptions if data is missing.
- CRITICAL GUARDRAIL: Never allow deletion of foundational tasks like sowing, planting, transplanting, or harvesting.
- CRITICAL GUARDRAIL: Cross-check crop identity. Refuse tasks if issue is incompatible with crop.
- CRITICAL GUARDRAIL: Cross-check crop age. Refuse treatments for stages that have not occurred yet.
- CRITICAL GUARDRAIL: Never recommend spraying if forecast shows heavy rain or high wind.
- CRITICAL GUARDRAIL: Never recommend irrigation if soil moisture is very high or flooded.
- CRITICAL GUARDRAIL: Prevent duplicate tasks by checking Active Pending Tasks first.
${ActionEnvelope.formatForModel({
  allowedActionTypes: ['create_task'],
  messagePlaceholder: 'Detailed diagnosis and mitigation steps.',
})}
Use create_task only when a follow-up task is clearly helpful.

Farm Context:
${context}`;

    let dynamicUserPrompt = userPrompt;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rawResponse = await AIService.generateResponse(systemPrompt, dynamicUserPrompt, base64Image, {
          expectJsonEnvelope: true,
          feature: 'assistant_image',
          retryAttempt: attempt,
          noCache: attempt > 1,
        });
        const parsed = ActionEnvelope.parse(rawResponse);
        if (!parsed.ok) {
          throw new Error('Action format is missing or invalid JSON');
        }

        const validated = ActionValidator.validateEnvelope({
          envelope: parsed.envelope,
          context: { maxActions: 3, horizonDays: 180, strict: true, enforceTimingContext: false, activeTasks },
        });
        if (!validated.ok) {
          throw new Error(`Validation failed: ${(validated.errors || ['bad format']).join(', ')}`);
        }

        const scanText = buildActionScanText(validated.envelope);
        const post = GuardrailsService.postCheck({ userPrompt, rawResponse: scanText, languageCode, jurisdiction });
        if (!post.ok) {
          await AIAuditService.logEvent({
            type: 'image_blocked_response',
            intent,
            languageCode,
            tags: post.tags || [],
            jurisdiction,
          }).catch(() => {});
          throw new Error(`Policy guardrail blocked response: ${post.message}`);
        }

        const envelope = { ...validated.envelope, message: ResponseFormatter.format(validated.envelope.message || '') };
        const execResults = await ActionExecutor.execute({ envelope, context: { source: 'image' } });
        for (const c of execResults.created || []) {
          const t = c?.task;
          if (!t?.title || !t?.date) continue;
          await NotificationService.scheduleLocalNotification(
            'Task Scheduled',
            `"${t.title}" added for ${t.date}`,
            2
          ).catch(() => {});
        }

        await AIAuditService.logEvent({
          type: 'image_result',
          intent,
          languageCode,
          createdCount: (execResults.created || []).length,
          jurisdiction,
        }).catch(() => {});

        return formatForUser({ message: envelope.message, execResults });
      } catch (e) {
        if (attempt === 3) {
          return safeT('errors:ai.action_validation_failed');
        }
        dynamicUserPrompt = `${userPrompt}\nValidation fix required: ${e.message}\nReturn corrected JSON only.`;
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    return safeT('errors:ai.action_validation_failed');
  },
};
