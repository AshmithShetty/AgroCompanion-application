import { TaskRepository } from './TaskRepository';
import { PriorityManager } from './PriorityManager';

export const TaskScheduler = {
  scheduleAITask: async (title, dateString, taskType) => {
    const priority = PriorityManager.calculatePriority(taskType);
    await TaskRepository.createTask(title, dateString, priority);
  }
};