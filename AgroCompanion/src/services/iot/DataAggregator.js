import { CacheManager } from '../CacheManager';

const SENSOR_TTL_MINUTES = 45;

export const DataAggregator = {
  cacheLatestValue: async (type, value) => {
    try {
      const ttlDays = SENSOR_TTL_MINUTES / (24 * 60);
      await CacheManager.setCache(`sensor_${type}`, { value, ts: Date.now() }, 'SENSOR_VALUE', ttlDays);
    } catch (error) {}
  },

  getOfflineValue: async (type) => {
    try {
      const cached = await CacheManager.getAnyCache(`sensor_${type}`);
      if (!cached || typeof cached.value === 'undefined') {
        return null;
      }
      const ts = typeof cached.ts === 'number' ? cached.ts : null;
      if (ts && Date.now() - ts > SENSOR_TTL_MINUTES * 60 * 1000) {
        return null;
      }
      const num = Number(cached.value);
      return Number.isFinite(num) ? num : null;
    } catch (error) {
      return null;
    }
  }
};
