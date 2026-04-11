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
  crop: 'You are an Agronomist Agent for farmers. Provide actionable, detailed, and highly definite agronomy advice using the farm context. You MUST specify exact product/brand names, mixing dosages (e.g. kg/acre, ml/L), and precise methodologies (e.g. ploughing depths) instead of generic advice.',
  market: 'You are a Market and Finance Agent. Provide crop pricing trends and economic advice based on the supplied market prices.',
  general: 'You are the AgroCompanion Orchestrator. Help the farmer with general queries.',
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
  const lines = keys.map(key => {
    const d = days[key];
    const tempRange = d.minTemp === null || d.maxTemp === null ? 'temp N/A' : `${Math.round(d.minTemp)}-${Math.round(d.maxTemp)}°C`;
    const rainLabel = `${Math.round(d.rainMm * 10) / 10}mm rain`;
    const windLabel = `${Math.round(d.maxWind * 10) / 10}m/s wind`;
    const humLabel = `${Math.round(d.maxHumidity)}% humidity`;
    return `${key}: ${tempRange}, ${rainLabel}, ${windLabel}, ${humLabel}`;
  });

  return lines.join('\n');
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

const buildSystemPrompt = ({ intent, jurisdiction, context, sensorSnapshot, forecastSummary, taskContext }) => {
  const base = AGENT_PROMPTS[intent] || AGENT_PROMPTS.general;
  return `${base}
Jurisdiction: ${jurisdiction}
Policy constraints:
- You MUST provide highly detailed, definite instructional descriptions for every task.
- When recommending fertilizers or pesticides, provide specific product or brand names along with exact dosages and mixing quantities.
- For physical tasks like soil prep or ploughing, specify the exact methods, depths, and parameters.
${ActionEnvelope.formatForModel()}
Actions allowed:
- create_task with priority High|Medium|Low
- update_task with patch fields title/date/priority/description
- delete_task
Keep actions <= 2 for typical answers. If unsure, return no actions.

Farm Context:
${context}

Sensor Snapshot (current conditions):
${sensorSnapshot ? JSON.stringify(sensorSnapshot) : 'N/A'}

5-Day Weather Forecast Summary:
${forecastSummary}

${marketPricesSummary ? `Market Prices Summary:\n${marketPricesSummary}\n` : ''}
${taskContext}`;
};

const buildWorkflowNarrationPrompt = ({ intent, jurisdiction, context, sensorSnapshot, forecastSummary, workflowFacts, workflowHint }) => {
  const base = AGENT_PROMPTS[intent] || AGENT_PROMPTS.general;
  return `${base}
Jurisdiction: ${jurisdiction}
Policy constraints:
- You MUST provide highly detailed, definite conversational descriptions.
- When recommending fertilizers or pesticides, provide specific product or brand names along with exact dosages and mixing quantities.
- For physical tasks, specify the exact methods, depths, and parameters.
${ActionEnvelope.formatForModel()}
You must set actions to an empty array and only write the message.

Farm Context:
${context}

Sensor Snapshot:
${sensorSnapshot ? JSON.stringify(sensorSnapshot) : 'N/A'}

5-Day Weather Forecast Summary:
${forecastSummary}

Workflow facts:
${JSON.stringify(workflowFacts || {})}
Workflow hint: ${workflowHint || ''}`;
};

export const AgentOrchestrator = {
  routeQuery: async (userPrompt, intent = 'general') => {
    const context = ContextBuilder.buildFarmContext();
    const languageCode = LanguageService.getCurrentLanguage() || 'en';
    const jurisdiction = PolicyContext.resolveJurisdiction();

    const activeTasks = await TaskRepository.getAllTasks();
    const taskContext = `Active Pending Tasks:\n${activeTasks.length === 0 ? 'None' : activeTasks.map(t => `ID: ${t.id} | Source: ${t.source || 'manual'} | Title: ${t.title} | Date: ${t.date} | Priority: ${t.priority}`).join('\n')}`;

    const { currentFarm } = useUserSessionStore.getState();
    const lat = Number(currentFarm?.latitude);
    const lon = Number(currentFarm?.longitude);
    let forecast = null;
    let forecastSummary = 'Forecast unavailable.';
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      try {
        forecast = await WeatherService.getForecast(lat, lon);
        forecastSummary = summarizeForecast(forecast);
      } catch {
        forecastSummary = 'Forecast unavailable.';
      }
    }

    let sensorSnapshot = null;
    try {
      sensorSnapshot = await getSensorSnapshot();
    } catch {
      sensorSnapshot = null;
    }

    let marketPricesSummary = 'Market prices unavailable.';
    try {
      const crop = currentSession?.cropType;
      const state = currentFarm?.stateName || currentFarm?.state || '';
      const district = currentFarm?.districtName || '';
      
      const { MarketDataService } = require('../market/MarketDataService');
      
      if (crop && intent === 'market') {
        const prices = await MarketDataService.getMandiPrices(crop, state, district);
        if (prices && prices.length > 0) {
           const maxPriceIdx = Math.max(1, Math.min(5, prices.length));
           marketPricesSummary = prices.slice(0, maxPriceIdx).map(p => `${p.market} (${p.district}, ${p.state}): Min INR${p.min_price}, Max INR${p.max_price}, Mode INR${p.modal_price}`).join('\n');
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
        context,
        sensorSnapshot,
        forecastSummary,
        workflowFacts: wfResult.facts || {},
        workflowHint: wfResult.narrativeHint || '',
      });
      const rawNarrative = await AIService.generateResponse(narrativePrompt, userPrompt, null, { expectJsonEnvelope: true });
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
        context: { maxActions: 5, horizonDays: 180, strict: true, sensorSnapshot, forecastSummary, enforceTimingContext: true },
      });
      if (!validated.ok) {
        AppLogger.publish('Guardrails', `action_validation_failed`);
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
      context,
      sensorSnapshot,
      forecastSummary,
      taskContext,
      marketPricesSummary,
    });

    AppLogger.publish('AI Query', `[${intent}] ${userPrompt.slice(0, 80)}`);

    let dynamicUserPrompt = userPrompt;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rawResponse = await AIService.generateResponse(systemPrompt, dynamicUserPrompt, null, { expectJsonEnvelope: true });
        const parsed = ActionEnvelope.parse(rawResponse);
        if (!parsed.ok) {
          throw new Error('Action format is missing or invalid JSON');
        }

        const validated = ActionValidator.validateEnvelope({
          envelope: parsed.envelope,
          context: { maxActions: 3, horizonDays: 180, strict: true, sensorSnapshot, forecastSummary, enforceTimingContext: true },
        });
        if (!validated.ok) {
          if ((validated.errors || []).includes('missing_soil_context')) throw new Error('missing_soil_context');
          if ((validated.errors || []).includes('missing_forecast_context')) throw new Error('missing_forecast_context');
          throw new Error('Validation failed: ' + (validated.errors || ['bad format']).join(', '));
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
        
        dynamicUserPrompt = `${userPrompt}\n\n[SYSTEM FEEDBACK]: Your previous attempt was rejected. Reason: ${e.message}. You must strictly rewrite your response to comply with constraints. Provide a safe workaround or conversational answer if a task was rejected.`;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  },

  analyzeImage: async (base64Image, intent = 'crop') => {
    const context = ContextBuilder.buildFarmContext();
    const languageCode = LanguageService.getCurrentLanguage() || 'en';
    const jurisdiction = PolicyContext.resolveJurisdiction();

    const userPrompt = 'Please diagnose the pathology in this image and provide mitigation steps.';
    const pre = GuardrailsService.preCheck({
      userPrompt,
      languageCode,
      sensorSnapshot: null,
      forecastSummary: 'Forecast unavailable.',
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
Policy constraints:
- You MUST provide highly detailed, definite instructional descriptions.
- When recommending pesticide treatments, provide specific product/brand names along with exact dosages and mixing quantities.
${ActionEnvelope.formatForModel()}
Use 0-2 actions only if needed.

Farm Context:
${context}`;

    let dynamicUserPrompt = userPrompt;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rawResponse = await AIService.generateResponse(systemPrompt, dynamicUserPrompt, base64Image, { expectJsonEnvelope: true });
        const parsed = ActionEnvelope.parse(rawResponse);
        if (!parsed.ok) {
          throw new Error('Action format is missing or invalid JSON');
        }

        const validated = ActionValidator.validateEnvelope({
          envelope: parsed.envelope,
          context: { maxActions: 3, horizonDays: 180, strict: true, enforceTimingContext: false },
        });
        if (!validated.ok) {
          throw new Error('Validation failed: ' + (validated.errors || ['bad format']).join(', '));
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
        dynamicUserPrompt = `${userPrompt}\n\n[SYSTEM FEEDBACK]: Your previous attempt was rejected. Reason: ${e.message}. You must strictly rewrite your response to comply with constraints. Provide a safe workaround if a task was rejected.`;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  },
};
