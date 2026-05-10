import { AIService } from './AIService';
import { useUserSessionStore } from '../../store';
import { NotificationService } from '../notifications/NotificationService';
import { TaskRepository } from '../TaskRepository';

export const WeeklyReporterAgent = {
  generateWeeklyReport: async (sensorAverages) => {
    const { currentFarm, currentSession } = useUserSessionStore.getState();
    const cropType = currentSession?.cropType || 'Unknown';
    const tasks = await TaskRepository.getAllTasks();
    const recentTasks = tasks.filter(t => t.status === 'completed');

    const systemPrompt = `You are a strict Weekly Farm Reporter Agent.
Analyze the farm's sensor averages and completed tasks by fetching them using the 'get_sensor_averages' and 'get_recent_tasks' tools. Generate a concise, 2-3 sentence summary that clearly states the farm's health and any immediate actions needed. Do not use generic statements; use the exact sensor values provided by the tools.
Output strictly as JSON:
{
  "title": "Weekly Farm Report",
  "summary": "string"
}`;

    const userPrompt = `Crop: ${cropType}
Fetch the 7-Day Sensor Averages and Completed Tasks using your tools.`;

    try {
      const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt, null, {
        expectJsonEnvelope: false,
        responseFormat: { type: 'json_object' },
        feature: 'weekly_reporter',
        useTools: true
      });
      const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      const report = JSON.parse(cleaned);

      await NotificationService.scheduleLocalNotification(
        report.title,
        report.summary,
        1
      );

      return report;
    } catch (e) {
      return null;
    }
  }
};
