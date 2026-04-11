import AsyncStorage from '@react-native-async-storage/async-storage';

const AUDIT_KEY = '@ai_audit_log_v1';
const MAX_EVENTS = 250;

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

    const existingRaw = await AsyncStorage.getItem(AUDIT_KEY);
    const existing = safeJsonParse(existingRaw);
    const list = Array.isArray(existing) ? existing : [];
    const next = [payload, ...list].slice(0, MAX_EVENTS);
    await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(next));
    return payload;
  },

  getRecent: async (limit = 50) => {
    const raw = await AsyncStorage.getItem(AUDIT_KEY);
    const parsed = safeJsonParse(raw);
    const list = Array.isArray(parsed) ? parsed : [];
    return list.slice(0, Math.max(0, Math.min(250, Number(limit) || 50)));
  },

  clear: async () => {
    await AsyncStorage.removeItem(AUDIT_KEY);
  },
};

