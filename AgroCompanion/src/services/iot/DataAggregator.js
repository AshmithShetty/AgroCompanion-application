import { CacheManager } from '../CacheManager';

export const DataAggregator = {
  cacheLatestValue: async (type, value) => {
    try {
      await CacheManager.setCache(`sensor_${type}`, { value }, 'SENSOR_VALUE', 30);
    } catch (error) {}
  },

  getOfflineValue: async (type) => {
    try {
      const cached = await CacheManager.getAnyCache(`sensor_${type}`);
      if (cached && typeof cached.value !== 'undefined') {
        return Number(cached.value);
      }
      return null;
    } catch (error) {
      return null;
    }
  }
};
