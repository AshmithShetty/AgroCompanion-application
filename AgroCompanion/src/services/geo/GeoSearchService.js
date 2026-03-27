import { CacheManager } from '../CacheManager';
import { NetworkService } from '../NetworkService';

const SEARCH_TTL_DAYS = 30;
const SEARCH_LIMIT = 5;

const normalizeSearchResult = (result) => ({
  id: String(result.place_id || `${result.lat}_${result.lon}`),
  label: result.display_name || 'Unknown location',
  latitude: Number(result.lat),
  longitude: Number(result.lon),
  raw: result,
});

const buildSearchCacheKey = (query) => `geo_search:${query.trim().toLowerCase()}`;
const buildReverseCacheKey = ({ latitude, longitude }) => `reverse_geocode:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;

export const GeoSearchService = {
  searchPlaces: async (query) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      return [];
    }

    const cacheKey = buildSearchCacheKey(trimmedQuery);
    const isOnline = await NetworkService.checkConnection();

    if (!isOnline) {
      return (await CacheManager.getAnyCache(cacheKey)) || [];
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=${SEARCH_LIMIT}&q=${encodeURIComponent(trimmedQuery)}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      });
      const data = await response.json();
      const results = Array.isArray(data) ? data.map(normalizeSearchResult).filter(result => Number.isFinite(result.latitude) && Number.isFinite(result.longitude)) : [];
      await CacheManager.setCache(cacheKey, results, 'geo_search', SEARCH_TTL_DAYS);
      return results;
    } catch (error) {
      return (await CacheManager.getAnyCache(cacheKey)) || [];
    }
  },

  reverseGeocode: async (point) => {
    if (!point || !Number.isFinite(point.latitude) || !Number.isFinite(point.longitude)) {
      return null;
    }

    const cacheKey = buildReverseCacheKey(point);
    const isOnline = await NetworkService.checkConnection();

    if (!isOnline) {
      return await CacheManager.getAnyCache(cacheKey);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${encodeURIComponent(point.latitude)}&lon=${encodeURIComponent(point.longitude)}`;
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'en',
        },
      });
      const data = await response.json();
      await CacheManager.setCache(cacheKey, data, 'reverse_geocode', SEARCH_TTL_DAYS);
      return data;
    } catch (error) {
      return await CacheManager.getAnyCache(cacheKey);
    }
  },
};
