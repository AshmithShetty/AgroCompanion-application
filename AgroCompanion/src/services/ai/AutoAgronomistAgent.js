import { AIService } from './AIService';
import { ContextBuilder, ResponseFormatter } from './PromptUtils';
import { TaskRepository } from '../TaskRepository';
import { NotificationService } from '../notifications/NotificationService';
import { NotificationRepository } from '../notifications/NotificationRepository';
import { AppLogger } from '../iot/AppLogger';

const TASK_REGEX = /TASK\[([^\|]+)\|(\d{4}-\d{2}-\d{2})\|([^\|]+)\|([^\]]+)\]/gi;

export const AutoAgronomistAgent = {
  analyzeAnomaly: async (sensorData) => {
    const context = ContextBuilder.buildFarmContext();
    const systemPrompt = `You are an autonomous AI Agronomist monitoring live IoT data.
The current real-world date is ${new Date().toISOString().split('T')[0]}.
A critical sensor threshold has been breached.
Farm Context:
${context}

Rules:
1. Output exactly 1 sentence explaining the risk.
2. Output exactly 1 mitigation task formatted as TASK[title|YYYY-MM-DD|priority|detailed_description]. The title must be a concise heading. The detailed_description must be highly descriptive, taking the crop, soil, and regional context into account. Name exact methodologies and precise localized product brands (rescue chemicals/fertilizers) available natively in the area if applicable.
Do not output anything else.`;

    const userPrompt = `Sensor Anomaly Detected: ${sensorData.type} = ${sensorData.value}`;
    
    AppLogger.publish('AutoAgronomist Triggered', `Analyzing ${sensorData.type} anomaly: ${sensorData.value}`);

    try {
      const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt);
      const formattedResponse = ResponseFormatter.format(rawResponse);
      
      let match;
      
      while ((match = TASK_REGEX.exec(formattedResponse)) !== null) {
        const [, title, date, priority, description] = match;
        await TaskRepository.createTask(title.trim(), date, priority, 'ai', `iot_${sensorData.type}`, description.trim());
        AppLogger.publish('Autonomous Task', `${title.trim()} | ${date} | ${priority}`);
      }
      
      const messageBody = formattedResponse.replace(TASK_REGEX, '').trim();
      
      await NotificationService.scheduleLocalNotification(
        'AI Agronomist Alert',
        messageBody,
        1
      );
      
      await NotificationRepository.createNotification(
        'AI Agronomist Alert',
        messageBody,
        'alert',
        2
      );
      
      AppLogger.publish('AutoAgronomist Decision', messageBody);
      
    } catch (e) {
      AppLogger.publish('AutoAgronomist Error', e.message);
    }
  }
};
