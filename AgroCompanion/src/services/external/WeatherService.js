import { CacheManager } from '../CacheManager';
import { NetworkService } from '../NetworkService';
import { ConfigService } from '../../utils/ConfigService';

export const WeatherService = {
  getForecast: async (lat, lon) => {
    const cacheKey = `weather_${lat}_${lon}`;
    const isOnline = await NetworkService.checkConnection();

    if (!isOnline) {
      const cachedData = await CacheManager.getValidCache(cacheKey);
      if (cachedData) return cachedData;
      throw new Error("Offline_No_Cache");
    }

    try {
      const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${ConfigService.OPENWEATHER_KEY}&units=metric`;
      const response = await fetch(url);
      const data = await response.json();

      await CacheManager.setCache(cacheKey, data, 'WEATHER_FORECAST', 14);
      return data;
    } catch (error) {
      const cachedFallback = await CacheManager.getValidCache(cacheKey);
      if (cachedFallback) return cachedFallback;
      throw error;
    }
  }
};