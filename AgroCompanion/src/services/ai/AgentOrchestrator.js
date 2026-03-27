import { AIService } from './AIService';
import { ContextBuilder, ResponseFormatter } from './PromptUtils';
import { TaskRepository } from '../TaskRepository';
import { NotificationService } from '../notifications/NotificationService';
import { AppLogger } from '../iot/AppLogger';

const AGENT_PROMPTS = {
  crop: 'You are an expert Agronomist Agent. Provide actionable farming advice based on the farm context. When the user asks what to do, always include 1-2 specific tasks formulated as TASK[title|YYYY-MM-DD|priority|detailed_description]. The title must be a concise heading. The detailed_description must be highly precise, mentioning exact methodologies, specific fertilizer/pesticide product formulations, and exact regional brand names available natively in the area. Make it actionable. If the user explicitly asks to cancel or remove an existing pending task (scheduled for today or a future date), output strictly DELETE_TASK[task_id]. If the user explicitly asks to reschedule or edit an existing pending task (scheduled for today or a future date), output strictly UPDATE_TASK[task_id|date=YYYY-MM-DD|priority=...|title=...|description=...]. Provide only the keys that must change. NEVER attempt to delete or update tasks whose current scheduled date is before today.',
  market: 'You are a Market and Finance Agent. Provide crop pricing trends and economic advice.',
  general: 'You are the AgroCompanion AI Orchestrator. Help the farmer with general queries.'
};

const TASK_REGEX = /TASK\[([^\|]+)\|(\d{4}-\d{2}-\d{2})\|([^\|]+)\|([^\]]+)\]/gi;
const DELETE_TASK_REGEX = /DELETE_TASK\[([^\]]+)\]/gi;
const UPDATE_TASK_REGEX = /UPDATE_TASK\[([^\]]+)\]/gi;

export const AgentOrchestrator = {
  routeQuery: async (userPrompt, intent = 'general') => {
    const context = ContextBuilder.buildFarmContext();
    const activeTasks = await TaskRepository.getAllTasks();
    const taskContext = `Active Pending Tasks:\n${activeTasks.map(t => `ID: ${t.id} | Title: ${t.title} | Date: ${t.date} | Priority: ${t.priority}`).join('\n')}`;

    const systemPrompt = `${AGENT_PROMPTS[intent]}

Farm Context:
${context}

${taskContext}`;

    AppLogger.publish('AI Query', `[${intent}] ${userPrompt.slice(0, 80)}`);

    const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt);
    const formattedResponse = ResponseFormatter.format(rawResponse);

    let match;
    while ((match = TASK_REGEX.exec(formattedResponse)) !== null) {
      const [, title, date, priority, description] = match;
      try {
        await TaskRepository.createTask(title.trim(), date, priority, 'ai', null, description.trim());
        AppLogger.publish('Task Scheduled', `${title.trim()} | ${date} | ${priority}`);
        await NotificationService.scheduleLocalNotification(
          'Task Scheduled by AI',
          `"${title.trim()}" added for ${date}`,
          2
        );
      } catch (e) {}
    }

    const updateResults = [];
    let updateMatch;
    while ((updateMatch = UPDATE_TASK_REGEX.exec(formattedResponse)) !== null) {
      const [payload] = updateMatch.slice(1);
      const parts = String(payload || '').split('|').map(p => p.trim()).filter(p => p.length > 0);
      const taskId = parts[0];
      if (!taskId) {
        continue;
      }

      const patch = {};
      const valueParts = parts.slice(1);
      const positional = ['date', 'priority', 'title', 'description'];
      valueParts.forEach((part, index) => {
        if (!part) {
          return;
        }
        const eq = part.indexOf('=');
        if (eq > 0) {
          const key = part.slice(0, eq).trim().toLowerCase();
          const value = part.slice(eq + 1).trim();
          if (!value) {
            return;
          }
          if (key === 'date') patch.date = value;
          if (key === 'priority') patch.priority = value;
          if (key === 'title') patch.title = value;
          if (key === 'description') patch.description = value;
          return;
        }
        const key = positional[index];
        if (key && part) {
          patch[key] = part;
        }
      });

      try {
        const result = await TaskRepository.updateTask(taskId.trim(), patch);
        updateResults.push({ taskId: taskId.trim(), result });
        if (result?.ok) {
          AppLogger.publish('Task Updated', `${taskId.trim()} updated`);
        }
      } catch (e) {
        updateResults.push({ taskId: taskId.trim(), result: { ok: false, reason: 'error' } });
      }
    }

    const deleteResults = [];
    let deleteMatch;
    while ((deleteMatch = DELETE_TASK_REGEX.exec(formattedResponse)) !== null) {
      const [, taskId] = deleteMatch;
      try {
        const result = await TaskRepository.deleteFutureTask(taskId.trim());
        deleteResults.push({ taskId: taskId.trim(), result });
        if (result?.ok) {
          AppLogger.publish('Task Deleted', `AI deleted ${taskId.trim()}`);
        }
      } catch (e) {
        deleteResults.push({ taskId: taskId.trim(), result: { ok: false, reason: 'error' } });
      }
    }

    let finalResponse = formattedResponse.replace(TASK_REGEX, (match, title, date, priority, description) => {
      return `\n• ${title.trim()} (Due: ${date}, Priority: ${priority})\n  ↳ ${description.trim()}`;
    });

    finalResponse = finalResponse.replace(DELETE_TASK_REGEX, (match, taskId) => {
      const result = deleteResults.find(r => r.taskId === String(taskId).trim())?.result;
      if (result?.ok) {
        return `\n• Task deleted.`;
      }
      if (result?.reason === 'immutable_past') {
        return `\n• Task not deleted (past tasks are immutable).`;
      }
      return `\n• Task not deleted.`;
    });

    finalResponse = finalResponse.replace(UPDATE_TASK_REGEX, (match, payload) => {
      const parts = String(payload || '').split('|').map(p => p.trim()).filter(p => p.length > 0);
      const taskId = parts[0] ? parts[0].trim() : '';
      const result = updateResults.find(r => r.taskId === taskId)?.result;
      if (result?.ok) {
        return `\n• Task updated.`;
      }
      if (result?.reason === 'immutable_past') {
        return `\n• Task not updated (past tasks are immutable).`;
      }
      return `\n• Task not updated.`;
    });

    return finalResponse.trim();
  },

  analyzeImage: async (base64Image, intent = 'crop') => {
    const context = ContextBuilder.buildFarmContext();
    const systemPrompt = `You are an expert Agricultural Plant Pathologist AI. 
Analyze this high-resolution image of the user's crop.
Farm Context:
${context}

Identify the specific disease, pest, or deficiency. Then provide a clear, actionable cure or mitigation strategy. Output 1-2 recommended tasks if applicable using the TASK[title|YYYY-MM-DD|priority|detailed_description] format. The detailed_description must be highly precise, diagnosing with regional contexts and specifically naming available local chemical/organic rescue products.`;

    AppLogger.publish('AI Image Diagnosis', `Analyzing uploaded crop image`);

    const userPrompt = "Please diagnose the pathology in this image and provide a cure.";
    
    const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt, base64Image);
    const formattedResponse = ResponseFormatter.format(rawResponse);

    let match;
    while ((match = TASK_REGEX.exec(formattedResponse)) !== null) {
      const [, title, date, priority, description] = match;
      try {
        await TaskRepository.createTask(title.trim(), date, priority, 'ai', null, description.trim());
        AppLogger.publish('Task Scheduled', `${title.trim()} | ${date} | ${priority}`);
        await NotificationService.scheduleLocalNotification(
          'Task Scheduled by AI',
          `"${title.trim()}" added for ${date}`,
          2
        );
      } catch (e) {
        console.error('Failed to create AI task:', e);
      }
    }

    return formattedResponse.replace(TASK_REGEX, (match, title, date, priority, description) => {
      return `\n• ${title.trim()} (Due: ${date}, Priority: ${priority})\n  ↳ ${description.trim()}`;
    }).trim();
  }
};
