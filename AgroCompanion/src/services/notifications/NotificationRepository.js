import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';
import { useUserSessionStore } from '../../store';

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

export const NotificationRepository = {
  createNotification: async (title, message, type, priority, scope = {}) => {
    const collection = database.get('notifications');
    const resolvedScope = resolveScope(scope);
    await database.write(async () => {
      await collection.create(record => {
        record.userId = resolvedScope.userId || '';
        record.farmId = resolvedScope.farmId || '';
        record.sessionId = resolvedScope.sessionId || '';
        record.title = title;
        record.message = message;
        record.type = type;
        record.priority = priority;
        record.isRead = false;
        record._raw.created_at = Date.now();
      });
    });
  },

  getUnread: async (scope = {}) => {
    const collection = database.get('notifications');
    const resolvedScope = resolveScope(scope);
    return await collection.query(
      ...buildScopeQueries(resolvedScope),
      Q.where('is_read', false),
      Q.sortBy('created_at', Q.desc)
    ).fetch();
  },

  getAll: async (scope = {}) => {
    const collection = database.get('notifications');
    const resolvedScope = resolveScope(scope);
    return await collection.query(
      ...buildScopeQueries(resolvedScope),
      Q.sortBy('created_at', Q.desc)
    ).fetch();
  },

  markAsRead: async (id, scope = {}) => {
    const collection = database.get('notifications');
    const record = await collection.find(id);
    const resolvedScope = resolveScope(scope);

    if (resolvedScope.userId && record.userId !== resolvedScope.userId) {
      return;
    }

    if (resolvedScope.farmId && record.farmId !== resolvedScope.farmId) {
      return;
    }

    if (resolvedScope.sessionId && record.sessionId !== resolvedScope.sessionId) {
      return;
    }

    await database.write(async () => {
      await record.update(r => {
        r.isRead = true;
      });
    });
  }
};
