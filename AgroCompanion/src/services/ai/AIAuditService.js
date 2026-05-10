import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserSessionStore } from '../../store';

const MAX_EVENTS = 500;

const getAuditKey = () => {
  const { currentUser } = useUserSessionStore.getState();
  const userId = currentUser?.id || 'anonymous';
  return `@ai_audit_log_v1_${userId}`;
};

const safeJsonParse = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const nowIso = () => new Date().toISOString();

const newId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

export const AIAuditService = {
  logEvent: async (event) => {
    const payload = {
      id: newId(),
      ts: nowIso(),
      ...event,
    };

    const key = getAuditKey();
    const existingRaw = await AsyncStorage.getItem(key);
    const existing = safeJsonParse(existingRaw);
    const list = Array.isArray(existing) ? existing : [];
    const next = [payload, ...list].slice(0, MAX_EVENTS);
    await AsyncStorage.setItem(key, JSON.stringify(next));
    return payload;
  },

  getRecent: async (limit = 50) => {
    const key = getAuditKey();
    const raw = await AsyncStorage.getItem(key);
    const parsed = safeJsonParse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.slice(0, Math.max(0, Math.min(MAX_EVENTS, Number(limit) || 50)));
  },

  getRequestMetricsSummary: async () => {
    const key = getAuditKey();
    const raw = await AsyncStorage.getItem(key);
    const parsed = safeJsonParse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    const metrics = list.filter(item => item?.type === 'ai_request_metric');
    const summary = metrics.reduce((acc, item) => {
      const feature = item.feature || 'unknown';
      if (!acc[feature]) {
        acc[feature] = {
          requests: 0,
          cacheHits: 0,
          promptTokensEstimated: 0,
          completionTokensEstimated: 0,
          promptTokensProvider: 0,
          completionTokensProvider: 0,
        };
      }
      acc[feature].requests += 1;
      acc[feature].cacheHits += item.cacheHit ? 1 : 0;
      acc[feature].promptTokensEstimated += Number(item.promptTokensEstimated) || 0;
      acc[feature].completionTokensEstimated += Number(item.completionTokensEstimated) || 0;
      acc[feature].promptTokensProvider += Number(item.promptTokensProvider) || 0;
      acc[feature].completionTokensProvider += Number(item.completionTokensProvider) || 0;
      return acc;
    }, {});
    return summary;
  },

  clear: async () => {
    const key = getAuditKey();
    await AsyncStorage.removeItem(key);
  },
};
