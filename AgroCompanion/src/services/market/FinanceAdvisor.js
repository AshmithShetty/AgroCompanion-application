import { CacheManager } from '../CacheManager';
import { NetworkMonitor } from '../NetworkMonitor';

export const FinanceAdvisor = {
  getSchemes: async (state = 'Karnataka') => {
    const cacheKey = `schemes_${state}`;
    const isOnline = await NetworkMonitor.checkConnection();

    if (!isOnline) {
      const cachedData = await CacheManager.getValidCache(cacheKey);
      if (cachedData) return cachedData;
      throw new Error("Offline_No_Cache");
    }

    try {
      const mockSchemes = [
        { id: '1', name: 'PM-KISAN', benefit: '6000 INR/year' },
        { id: '2', name: 'Krishi Bhagya', benefit: 'Rainwater harvesting subsidy' }
      ];
      await CacheManager.setCache(cacheKey, mockSchemes, 'GOVT_SCHEME', 30);
      return mockSchemes;
    } catch (error) {
      const cachedFallback = await CacheManager.getValidCache(cacheKey);
      if (cachedFallback) return cachedFallback;
      throw error;
    }
  }
};