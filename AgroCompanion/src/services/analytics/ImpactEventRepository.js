import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';
import { useUserSessionStore } from '../../store';
import { CacheManager } from '../CacheManager';
import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';

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

const invalidateImpactCache = async (sessionId) => {
  if (!sessionId) {
    return;
  }
  await CacheManager.removeCache(`impact_metrics:${sessionId}`);
};

export const ImpactEventRepository = {
  createEvent: async ({ type, quantity, unit, costInInr = null, notes = '', source = 'manual' }, scope = {}) => {
    const collection = database.get('impact_events');
    const resolvedScope = resolveScope(scope);
    const safeQuantity = Number(quantity);
    const safeCost = costInInr === null || costInInr === undefined ? 0 : Number(costInInr);

    if (!resolvedScope.sessionId || !resolvedScope.farmId || !type || !Number.isFinite(safeQuantity)) {
      return null;
    }

    let created;
    await database.write(async () => {
      created = await collection.create(record => {
        record.userId = resolvedScope.userId || '';
        record.farmId = resolvedScope.farmId || '';
        record.sessionId = resolvedScope.sessionId || '';
        record.type = type;
        record.quantity = safeQuantity;
        record.unit = unit || '';
        record.costInInr = Number.isFinite(safeCost) ? safeCost : 0;
        record.notes = notes || '';
        record.source = source || 'manual';
        record._raw.recorded_at = Date.now();
      });
    });

    await invalidateImpactCache(resolvedScope.sessionId);
    EventBusService.publish(EVENT_TOPICS.IMPACT_EVENT_CREATED, { sessionId: resolvedScope.sessionId, eventId: created?.id || null });
    return created;
  },

  getEvents: async (scope = {}, { limit = null } = {}) => {
    const collection = database.get('impact_events');
    const resolvedScope = resolveScope(scope);
    const events = await collection.query(
      ...buildScopeQueries(resolvedScope),
      Q.sortBy('recorded_at', Q.desc)
    ).fetch();

    if (limit && Number.isFinite(Number(limit))) {
      return events.slice(0, Number(limit));
    }

    return events;
  },

  clearAutomatedEvents: async (scope = {}) => {
    const collection = database.get('impact_events');
    const resolvedScope = resolveScope(scope);
    const automatedEvents = await collection.query(
      ...buildScopeQueries(resolvedScope),
      Q.where('source', 'ai')
    ).fetch();

    if (automatedEvents.length > 0) {
      await database.write(async () => {
        for (const event of automatedEvents) {
          await event.destroyPermanently();
        }
      });
      await invalidateImpactCache(resolvedScope.sessionId);
    }
  },
};
