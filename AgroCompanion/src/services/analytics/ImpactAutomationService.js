import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';
import { TaskRepository } from '../TaskRepository';
import { AIService } from '../ai/AIService';
import { ImpactEventRepository } from './ImpactEventRepository';
import { useUserSessionStore } from '../../store';
import { AppLogger } from '../iot/AppLogger';

class ImpactAutomationServiceImpl {
  init() {
    EventBusService.subscribe(EVENT_TOPICS.TASK_RESOLVED, async () => {
      await this.calculateImpactFromCompletedTasks();
    });
  }

  async calculateImpactFromCompletedTasks() {
    const { currentSession, currentFarm } = useUserSessionStore.getState();
    if (!currentSession?.id || !currentFarm?.id) {
      return;
    }

    try {
      const scope = { sessionId: currentSession.id };
      const resolvedTasks = await TaskRepository.getResolvedTasks(scope);

      if (!resolvedTasks || resolvedTasks.length === 0) {
        return;
      }

      const taskTitles = resolvedTasks.map(t => `${t.title} (Completed: ${t.date})`);

      const systemPrompt = `You are an AI Impact Calculator. Based ONLY on the following completed agricultural tasks for a ${currentSession.cropType} farm, estimate the aggregate savings or impact.
Return a STRICT JSON object containing exactly these numeric keys: waterSavedL, fertilizerReducedKg, pesticideReducedG, co2eAvoidedKg.
If a task implies irrigation optimization, estimate water savings in Liters. 
If it implies fertilizer/pesticide reduction, estimate in kg/g. 
Return 0 for metrics that cannot be reasonably estimated.`;

      const userPrompt = `Completed Tasks:\n${taskTitles.join('\n')}\nPlease calculate the total impact.`;

      AppLogger.publish('AI Impact', 'Calculating savings from completed tasks...');

      const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt);
      const start = rawResponse.indexOf('{');
      const end = rawResponse.lastIndexOf('}');
      
      if (start === -1 || end === -1) {
        return;
      }

      const payload = JSON.parse(rawResponse.substring(start, end + 1));

      await ImpactEventRepository.clearAutomatedEvents(scope);

      if (payload.waterSavedL) {
        await ImpactEventRepository.createEvent({ type: 'irrigation', quantity: payload.waterSavedL, unit: 'L', costInInr: 0, notes: 'AI Calculated', source: 'ai' }, scope);
      }
      if (payload.fertilizerReducedKg) {
        await ImpactEventRepository.createEvent({ type: 'fertilizer', quantity: payload.fertilizerReducedKg, unit: 'kg', costInInr: 0, notes: 'AI Calculated', source: 'ai' }, scope);
      }
      if (payload.pesticideReducedG) {
        await ImpactEventRepository.createEvent({ type: 'pesticide', quantity: payload.pesticideReducedG, unit: 'g', costInInr: 0, notes: 'AI Calculated', source: 'ai' }, scope);
      }
      
      AppLogger.publish('AI Impact', 'Impact metrics updated automatically.');
    } catch (error) {
    }
  }
}

export const ImpactAutomationService = new ImpactAutomationServiceImpl();
