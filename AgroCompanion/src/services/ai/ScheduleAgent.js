import { AIService } from './AIService';
import { ResponseFormatter } from './PromptUtils';
import { GuardrailsService } from './GuardrailsService';
import { AIAuditService } from './AIAuditService';
import { ActionEnvelope } from './actions/ActionEnvelope';
import { ActionValidator } from './actions/ActionValidator';
import { ActionExecutor } from './actions/ActionExecutor';
import { AppLogger } from '../iot/AppLogger';
import { LanguageService } from '../LanguageService';
import { PolicyContext } from './policy/PolicyContext';

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

export const ScheduleAgent = {
  generateMasterSchedule: async (sessionData, environmentalContext) => {
    AppLogger.publish('ScheduleAgent', `Building master schedule for ${sessionData.cropType}`);
    const languageCode = LanguageService.getCurrentLanguage() || 'en';
    const jurisdiction = PolicyContext.resolveJurisdiction();

    const startDate = new Date(sessionData.startDate).toISOString().split('T')[0];

    const systemPrompt = `You are a Master Agricultural Planner.
You must generate a schedule that is practical and compliant.
Jurisdiction: ${jurisdiction}
Constraints:
- You MUST provide highly detailed, definite instructional descriptions for every task.
- When recommending fertilizers or pesticides, you MUST provide specific product or brand names along with exact dosages and mixing quantities (e.g., kg/acre, ml/L) precisely tailored to the farm context.
- For physical tasks like soil prep or ploughing, specify the exact methods, depths, and parameters.
- Optimize all instructions to strictly match the provided deep farm context.
${ActionEnvelope.formatForModel()}
Rules:
- actions must contain 5 to 10 create_task objects
- action.type must be "create_task"
- priority must be High|Medium|Low
- dates must be realistic based on start date (${startDate})
- do not include update_task or delete_task

Use the message field for a 1-2 sentence summary of the schedule.`;

    const userPrompt = `Crop: ${sessionData.cropType}
Soil: ${sessionData.soilType || 'Unknown'}
Method: ${sessionData.farmingMethod || 'Conventional'}
Start Date: ${startDate}

Deep Farm Context:
${environmentalContext}`;

    const pre = GuardrailsService.preCheck({
      userPrompt,
      languageCode,
      sensorSnapshot: null,
      forecastSummary: 'Forecast unavailable.',
      jurisdiction,
      intent: 'schedule',
    });

    await AIAuditService.logEvent({
      type: 'schedule_query',
      languageCode,
      cropType: sessionData.cropType,
      startDate,
      jurisdiction,
      guardrails: pre,
    }).catch(() => {});

    if (!pre.ok) {
      AppLogger.publish('Guardrails', `schedule_pre_block: ${(pre.tags || []).join(',')}`);
      return false;
    }

    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt, null, { expectJsonEnvelope: true, noCache: attempt > 1 });
        const parsed = ActionEnvelope.parse(rawResponse);
        if (!parsed.ok) {
          throw new Error('schedule_action_parse_failed');
        }

        const validated = ActionValidator.validateEnvelope({ envelope: parsed.envelope, context: { maxActions: 12, horizonDays: 365, strict: false, enforceTimingContext: false } });
        if (!validated.ok) {
          throw new Error(`schedule_action_validation_failed: ${(validated.errors || []).join(', ')}`);
        }

        const createCount = (validated.envelope.actions || []).filter(a => a?.type === 'create_task').length;
        if (createCount < 4) {
          throw new Error('schedule_action_count_invalid');
        }

        const envelope = { ...validated.envelope, message: ResponseFormatter.format(validated.envelope.message || '') };
        const execResults = await ActionExecutor.execute({ envelope, context: { source: 'schedule' } });
        const tasksCreated = (execResults.created || []).length;

        AppLogger.publish('ScheduleAgent', `Successfully scheduled ${tasksCreated} master tasks.`);
        await AIAuditService.logEvent({
          type: 'schedule_result',
          languageCode,
          tasksCreated,
          jurisdiction,
        }).catch(() => {});

        return tasksCreated > 0;
      } catch (e) {
        lastError = e;
        AppLogger.publish('ScheduleAgentError', `Attempt ${attempt} failed: ${e.message}`);
        if (attempt < 3) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }
    
    return false;
  },
};
