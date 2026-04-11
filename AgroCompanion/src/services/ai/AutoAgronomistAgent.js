import { AIService } from './AIService';
import { ContextBuilder, ResponseFormatter } from './PromptUtils';
import { ActionEnvelope } from './actions/ActionEnvelope';
import { ActionValidator } from './actions/ActionValidator';
import { ActionExecutor } from './actions/ActionExecutor';
import { GuardrailsService } from './GuardrailsService';
import { AIAuditService } from './AIAuditService';
import { NotificationService } from '../notifications/NotificationService';
import { NotificationRepository } from '../notifications/NotificationRepository';
import { AppLogger } from '../iot/AppLogger';
import { LanguageService } from '../LanguageService';
import { PolicyContext } from './policy/PolicyContext';
import { TaskRepository } from '../TaskRepository';

const buildActionScanText = (envelope) => {
  const actions = Array.isArray(envelope?.actions) ? envelope.actions : [];
  const lines = actions.map(a => {
    if (!a || typeof a !== 'object') return '';
    if (a.type === 'create_task') {
      return `create_task: ${a.title || ''} | ${a.date || ''} | ${a.priority || ''} | ${a.description || ''}`;
    }
    return '';
  }).filter(Boolean);
  return `${envelope?.message || ''}\n${lines.join('\n')}`.trim();
};

const hasExistingTaskForSource = async (source) => {
  try {
    const pending = await TaskRepository.getAllTasks();
    return pending.some(t => t.source === source);
  } catch {
    return false;
  }
};

const buildActiveTasksContext = async () => {
  try {
    const tasks = await TaskRepository.getAllTasks();
    if (!tasks || tasks.length === 0) return 'No pending tasks.';
    return tasks.map(t => `ID: ${t.id} | Source: ${t.source || 'manual'} | Title: ${t.title} | Date: ${t.date} | Priority: ${t.priority}`).join('\n');
  } catch {
    return 'No pending tasks.';
  }
};

export const AutoAgronomistAgent = {
  analyzeAnomaly: async (sensorData) => {
    const source = `iot_${sensorData.type}`;

    const alreadyExists = await hasExistingTaskForSource(source);
    if (alreadyExists) {
      AppLogger.publish('AutoAgronomist', `Skipped duplicate task for ${source} - task already pending.`);
      return;
    }

    const context = ContextBuilder.buildFarmContext();
    const languageCode = LanguageService.getCurrentLanguage() || 'en';
    const jurisdiction = PolicyContext.resolveJurisdiction();
    const activeTasksContext = await buildActiveTasksContext();

    const systemPrompt = `You are an autonomous Agronomist monitoring live IoT data.
The current date is ${new Date().toISOString().split('T')[0]}.
Jurisdiction: ${jurisdiction}
Constraints:
- No brand or trade names
- No dosage, dilution, mixing, or tank-mix instructions unless the user provided label details (they did not)
${ActionEnvelope.formatForModel()}
Rules:
- message must be exactly 1 sentence explaining the risk
- actions must contain exactly 1 create_task
- the task must be a practical mitigation step that is safe and compliant
- Do NOT create a task if a task for the same issue already appears in the active task list below

Farm Context:
${context}

Active Pending Tasks (do not duplicate any of these):
${activeTasksContext}`;

    const userPrompt = `Sensor Anomaly Detected: ${sensorData.type} = ${sensorData.value}`;

    AppLogger.publish('AutoAgronomist Triggered', `Analyzing ${sensorData.type} anomaly: ${sensorData.value}`);

    const pre = GuardrailsService.preCheck({
      userPrompt,
      languageCode,
      sensorSnapshot: null,
      forecastSummary: 'Forecast unavailable.',
      jurisdiction,
    });

    await AIAuditService.logEvent({
      type: 'iot_anomaly_query',
      languageCode,
      sensorData,
      guardrails: pre,
      jurisdiction,
    }).catch(() => {});

    if (!pre.ok) {
      AppLogger.publish('Guardrails', `iot_pre_block: ${(pre.tags || []).join(',')}`);
      return;
    }

    let dynamicUserPrompt = userPrompt;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rawResponse = await AIService.generateResponse(systemPrompt, dynamicUserPrompt, null, { expectJsonEnvelope: true });
        const parsed = ActionEnvelope.parse(rawResponse);
        if (!parsed.ok) {
          throw new Error('Action format is missing or invalid JSON');
        }

        const validated = ActionValidator.validateEnvelope({ envelope: parsed.envelope, context: { maxActions: 1, horizonDays: 60, strict: true, enforceTimingContext: false } });
        if (!validated.ok) {
          throw new Error('Validation failed: ' + (validated.errors || ['bad format']).join(', '));
        }

        const scanText = buildActionScanText(validated.envelope);
        const post = GuardrailsService.postCheck({ userPrompt, rawResponse: scanText, languageCode, jurisdiction });
        if (!post.ok) {
          await AIAuditService.logEvent({
            type: 'iot_anomaly_blocked_response',
            languageCode,
            tags: post.tags || [],
            jurisdiction,
          }).catch(() => {});
          throw new Error(`Policy guardrail blocked response: ${post.message}`);
        }

        const envelope = { ...validated.envelope, message: ResponseFormatter.format(validated.envelope.message || '') };
        const execResults = await ActionExecutor.execute({ envelope, context: { source } });
        const messageBody = envelope.message || '';

        if (messageBody) {
          await NotificationService.scheduleLocalNotification(
            'AI Agronomist Alert',
            messageBody,
            1
          ).catch(() => {});

          await NotificationRepository.createNotification(
            'AI Agronomist Alert',
            messageBody,
            'alert',
            2
          ).catch(() => {});
        }

        AppLogger.publish('AutoAgronomist Decision', messageBody);
        await AIAuditService.logEvent({
          type: 'iot_anomaly_result',
          languageCode,
          messageBody,
          tasksCreated: (execResults.created || []).length,
          jurisdiction,
        }).catch(() => {});
        return;
      } catch (e) {
        AppLogger.publish('AutoAgronomist Error', `Attempt ${attempt} failed: ${e.message}`);
        if (attempt < 3) {
          dynamicUserPrompt = `${userPrompt}\n\n[SYSTEM FEEDBACK]: Your previous attempt was rejected. Reason: ${e.message}. You must strictly rewrite your response to comply. Provide a safe, observant workaround task instead.`;
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
  },
};
