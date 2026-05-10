import { ACTION_TYPES } from './ActionSchema';
import { TaskRepository } from '../../TaskRepository';
import { AppLogger } from '../../iot/AppLogger';
import { InventoryAgent } from '../InventoryAgent';

export const ActionExecutor = {
  execute: async ({ envelope, context }) => {
    const results = {
      created: [],
      updated: [],
      deleted: [],
      rejected: [],
    };

    const actions = Array.isArray(envelope?.actions) ? envelope.actions : [];
    const createdTasksBatch = [];
    
    for (const action of actions) {
      const type = action?.type;
      if (type === ACTION_TYPES.CREATE_TASK) {
        const res = await TaskRepository.createTask(
          action.title,
          action.date,
          action.priority,
          'ai',
          context?.source || action.source || null,
          action.description
        );
        if (res?.ok) {
          results.created.push({ task: res.task });
          AppLogger.publish('Task Scheduled', `${action.title} | ${action.date} | ${action.priority}`);
          createdTasksBatch.push({ title: action.title, description: action.description || '' });
        } else {
          results.rejected.push({ type, reason: res?.reason || 'rejected' });
        }
      }

      if (type === ACTION_TYPES.UPDATE_TASK) {
        const res = await TaskRepository.updateTask(action.task_id, action.patch);
        if (res?.ok) {
          results.updated.push({ taskId: action.task_id });
          AppLogger.publish('Task Updated', `${action.task_id} updated`);
        } else {
          results.rejected.push({ type, reason: res?.reason || 'rejected' });
        }
      }

      if (type === ACTION_TYPES.DELETE_TASK) {
        const res = await TaskRepository.deleteFutureTask(action.task_id);
        if (res?.ok) {
          results.deleted.push({ taskId: action.task_id });
          AppLogger.publish('Task Deleted', `AI deleted ${action.task_id}`);
        } else {
          results.rejected.push({ type, reason: res?.reason || 'rejected' });
        }
      }
    }

    if (createdTasksBatch.length > 0) {
      InventoryAgent.processTasksForInventory(createdTasksBatch).catch(e => console.log('Inventory error:', e));
    }

    return results;
  },
};

