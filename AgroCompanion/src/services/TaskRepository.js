import { database } from '../database';
import { Q } from '@nozbe/watermelondb';
import { EventBusService } from './EventBusService';
import { EVENT_TOPICS } from '../utils/EventRegistry';
import { useUserSessionStore } from '../store';

let resolveOverduePromise = null;

const normalizeDateKey = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }
  const candidate = value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
};

const getTodayDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (dateKey, days) => {
  const parts = String(dateKey || '').split('-').map(n => Number(n));
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) {
    return null;
  }
  const [y, m, d] = parts;
  const dt = new Date(y, m - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  dt.setDate(dt.getDate() + Number(days || 0));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

const isAllowedPriority = (value) => {
  const s = (value || '').toString().trim();
  if (!s) return false;
  const allowed = ['High', 'Medium', 'Low', 'paused'];
  return allowed.some(p => p.toLowerCase() === s.toLowerCase());
};

const taskMatchesScope = (task, scope) => {
  if (!task) {
    return false;
  }
  if (scope.userId && task.userId !== scope.userId) {
    return false;
  }
  if (scope.farmId && task.farmId !== scope.farmId) {
    return false;
  }
  if (scope.sessionId && task.sessionId !== scope.sessionId) {
    return false;
  }
  return true;
};

const getActiveScope = () => {
  const { currentUser, currentFarm, currentSession } = useUserSessionStore.getState();
  return {
    userId: currentUser?.id || null,
    farmId: currentFarm?.id || null,
    sessionId: currentSession?.id || null,
  };
};

const resolveScope = (scope = {}) => {
  const activeScope = getActiveScope();
  return {
    userId: scope.userId ?? activeScope.userId,
    farmId: scope.farmId ?? activeScope.farmId,
    sessionId: scope.sessionId ?? activeScope.sessionId,
  };
};

const buildScopeQueries = ({ userId, farmId, sessionId }) => {
  const queries = [];

  if (userId) {
    queries.push(Q.where('user_id', userId));
  }

  if (farmId) {
    queries.push(Q.where('farm_id', farmId));
  }

  if (sessionId) {
    queries.push(Q.where('session_id', sessionId));
  }

  return queries;
};

export const TaskRepository = {
  createTask: async (title, date, priority, type = 'general', source = null, description = '', scope = {}) => {
    const resolvedScope = resolveScope(scope);
    const titleText = (title || '').toString().trim();
    const dateKey = normalizeDateKey(date);
    const priorityText = (priority || '').toString().trim();
    const descText = (description || '').toString();

    if (!titleText) {
      return { ok: false, reason: 'invalid_title' };
    }

    if (!dateKey) {
      return { ok: false, reason: 'invalid_date' };
    }

    const horizonDays = 365;
    const todayKey = getTodayDateKey();
    const horizonKey = addDays(todayKey, horizonDays);
    if (horizonKey && dateKey > horizonKey) {
      return { ok: false, reason: 'date_outside_horizon' };
    }

    if (!isAllowedPriority(priorityText)) {
      return { ok: false, reason: 'invalid_priority' };
    }

    let newTask;
    const tasksCollection = database.get('tasks');
    await database.write(async () => {
      newTask = await tasksCollection.create(task => {
        task.userId = resolvedScope.userId || '';
        task.farmId = resolvedScope.farmId || '';
        task.sessionId = resolvedScope.sessionId || '';
        task.title = titleText;
        task.date = dateKey;
        task.priority = priorityText;
        task.status = 'pending';
        task.source = source;
        task.description = descText;
      });
    });
    EventBusService.publish(EVENT_TOPICS.TASK_CREATED, newTask);
    return { ok: true, task: newTask };
  },

  autoResolveOverdueTasks: async (scope = {}) => {
    if (resolveOverduePromise) {
      return resolveOverduePromise;
    }

    resolveOverduePromise = (async () => {
      try {
        const tasksCollection = database.get('tasks');
        const resolvedScope = resolveScope(scope);
        const todayKey = getTodayDateKey();
        const pending = await tasksCollection.query(
          ...buildScopeQueries(resolvedScope),
          Q.where('status', 'pending')
        ).fetch();

        const overdue = pending.filter(task => {
          const taskDateKey = normalizeDateKey(task.date);
          return taskDateKey ? taskDateKey < todayKey : false;
        });

        if (overdue.length === 0) {
          return 0;
        }

        await database.write(async () => {
          for (const task of overdue) {
            await task.update(record => {
              record.status = 'resolved';
            });
          }
        });

        EventBusService.publish(EVENT_TOPICS.TASK_RESOLVED, { reason: 'auto_resolve', count: overdue.length });
        return overdue.length;
      } finally {
        resolveOverduePromise = null;
      }
    })();

    return resolveOverduePromise;
  },

  getAllTasks: async (scope = {}) => {
    const tasksCollection = database.get('tasks');
    const resolvedScope = resolveScope(scope);
    await TaskRepository.autoResolveOverdueTasks(resolvedScope);
    return await tasksCollection.query(
      ...buildScopeQueries(resolvedScope),
      Q.where('status', 'pending'),
      Q.sortBy('date', Q.asc)
    ).fetch();
  },

  getResolvedTasks: async (scope = {}) => {
    const tasksCollection = database.get('tasks');
    const resolvedScope = resolveScope(scope);
    await TaskRepository.autoResolveOverdueTasks(resolvedScope);
    return await tasksCollection.query(
      ...buildScopeQueries(resolvedScope),
      Q.where('status', 'resolved'),
      Q.sortBy('date', Q.desc)
    ).fetch();
  },

  resolveTasksBySource: async (source, scope = {}) => {
    if (!source) return;
    const tasksCollection = database.get('tasks');
    const resolvedScope = resolveScope(scope);
    const tasksToResolve = await tasksCollection.query(
      ...buildScopeQueries(resolvedScope),
      Q.where('status', 'pending'),
      Q.where('source', source)
    ).fetch();

    if (tasksToResolve.length > 0) {
      await database.write(async () => {
        for (const task of tasksToResolve) {
          await task.update(t => {
            t.status = 'resolved';
          });
        }
      });
      EventBusService.publish(EVENT_TOPICS.TASK_RESOLVED, source);
    }
  },

  updateTask: async (taskId, patch = {}, scope = {}) => {
    const tasksCollection = database.get('tasks');
    const resolvedScope = resolveScope(scope);
    const todayKey = getTodayDateKey();

    let task;
    try {
      task = await tasksCollection.find(taskId);
    } catch (error) {
      return { ok: false, reason: 'not_found' };
    }

    if (!taskMatchesScope(task, resolvedScope)) {
      return { ok: false, reason: 'not_found' };
    }

    const currentDateKey = normalizeDateKey(task.date);
    if (task.status === 'resolved' || (currentDateKey && currentDateKey < todayKey)) {
      return { ok: false, reason: 'immutable_past' };
    }

    const nextDateKey = patch.date ? normalizeDateKey(patch.date) : currentDateKey;
    if (nextDateKey && nextDateKey < todayKey) {
      return { ok: false, reason: 'immutable_past' };
    }

    await database.write(async () => {
      await task.update(record => {
        if (patch.title !== undefined) record.title = patch.title;
        if (patch.date !== undefined) record.date = patch.date;
        if (patch.priority !== undefined) record.priority = patch.priority;
        if (patch.description !== undefined) record.description = patch.description;
      });
    });

    EventBusService.publish(EVENT_TOPICS.TASK_UPDATED, { taskId });
    return { ok: true };
  },

  deleteFutureTask: async (taskId, scope = {}) => {
    const tasksCollection = database.get('tasks');
    const resolvedScope = resolveScope(scope);
    const todayKey = getTodayDateKey();

    let task;
    try {
      task = await tasksCollection.find(taskId);
    } catch (error) {
      return { ok: false, reason: 'not_found' };
    }

    if (!taskMatchesScope(task, resolvedScope)) {
      return { ok: false, reason: 'not_found' };
    }

    const taskDateKey = normalizeDateKey(task.date);
    if (task.status === 'resolved' || (taskDateKey && taskDateKey < todayKey)) {
      return { ok: false, reason: 'immutable_past' };
    }

    await database.write(async () => {
      await task.destroyPermanently();
    });

    EventBusService.publish(EVENT_TOPICS.TASK_DELETED, { taskId });
    return { ok: true };
  },

  pauseIrrigationTasks: async (scope = {}) => {
    const tasksCollection = database.get('tasks');
    const resolvedScope = resolveScope(scope);
    const irrigationTasks = await tasksCollection.query(
      ...buildScopeQueries(resolvedScope),
      Q.where('status', 'pending'),
      Q.or(
        Q.where('title', Q.like('%water%')),
        Q.where('title', Q.like('%irrigat%'))
      )
    ).fetch();

    await database.write(async () => {
      for (const task of irrigationTasks) {
        await task.update(t => {
          t.priority = 'paused';
        });
      }
    });
  }
};
