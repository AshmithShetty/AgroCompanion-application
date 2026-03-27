import { AIService } from './AIService';
import { ResponseFormatter } from './PromptUtils';
import { TaskRepository } from '../TaskRepository';
import { AppLogger } from '../iot/AppLogger';

const TASK_REGEX = /TASK\[([^\|]+)\|(\d{4}-\d{2}-\d{2})\|(High|Medium|Low)\|([^\]]+)\]/g;

export const ScheduleAgent = {
  generateMasterSchedule: async (sessionData, environmentalContext) => {
    AppLogger.publish('ScheduleAgent', `Building master schedule for ${sessionData.cropType}`);
    
    const startDate = new Date(sessionData.startDate).toISOString().split('T')[0];
    
    const systemPrompt = `You are a Master Agricultural Planner AI.
Given the crop session details, start date, and deep farm context, generate a complete farming schedule from field preparation through to harvest and marketing.

Requirements:
- Generate 5 to 10 distinct, critical milestones.
- Stagger the dates realistically based on the start date (${startDate}) and crop growth cycle in that specific climate.
- Output each milestone exactly in this format: TASK[Title|YYYY-MM-DD|Priority|Detailed Description]
- Priorities can only be High, Medium, Low.
- The Title must be concise. The Detailed Description MUST be highly precise, mentioning exact methodologies, specific fertilizer/pesticide product formulations, and exact regional brand names available natively in the area. Make it actionable.
- Do not output anything else besides these task strings.`;

    const userPrompt = `Crop: ${sessionData.cropType}
Soil: ${sessionData.soilType || 'Unknown'}
Method: ${sessionData.farmingMethod || 'Conventional'}
Start Date: ${startDate}

Deep Farm Context:
${environmentalContext}`;

    try {
      const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt);
      const formattedResponse = ResponseFormatter.format(rawResponse);
      
      let match;
      let tasksCreated = 0;
      
      while ((match = TASK_REGEX.exec(formattedResponse)) !== null) {
        const [, title, date, priority, description] = match;
        await TaskRepository.createTask(title.trim(), date, priority, 'ai', null, description.trim());
        tasksCreated++;
      }
      
      AppLogger.publish('ScheduleAgent', `Successfully scheduled ${tasksCreated} master tasks.`);
      return true;
    } catch (e) {
      console.error('Schedule generation error:', e);
      AppLogger.publish('ScheduleAgentError', e.message);
      return false;
    }
  }
};
