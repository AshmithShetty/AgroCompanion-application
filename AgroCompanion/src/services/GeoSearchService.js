import { CacheManager } from './CacheManager';

const SEARCH_BASE_URL = 'https://nominatim.openstreetmap.org/search';
const REVERSE_BASE_URL = 'https://nominatim.openstreetmap.org/reverse';

const normalizeSearchResult = (result) => ({
  id: result.place_id ? String(result.place_id) : `${result.lat}_${result.lon}`,
  label: result.display_name,
  latitude: Number(result.lat),
  longitude: Number(result.lon),
  address: result.address || {},
});

const buildUrl = (baseUrl, params) => {
  const query = new URLSearchParams(params);
  return `${baseUrl}?${query.toString()}`;
};

const parseJsonResponse = async (response) => {
  if (!response.ok) {
    throw new Error(`Geo service error: ${response.status}`);
  }
  return response.json();
};

export const GeoSearchService = {
  searchPlaces: async (query) => {
    const normalizedQuery = String(query || '').trim();
    if (!normalizedQuery) {
      return [];
    }

    const cacheKey = `geo_search:${normalizedQuery.toLowerCase()}`;
    const cached = await CacheManager.getValidCache(cacheKey);
    if (cached) {
      return cached;
    }

    const url = buildUrl(SEARCH_BASE_URL, {
      q: normalizedQuery,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '5',
    });

    const payload = await parseJsonResponse(await fetch(url, { headers: { Accept: 'application/json' } }));
    const results = Array.isArray(payload) ? payload.map(normalizeSearchResult) : [];

    await CacheManager.setCache(cacheKey, results, 'GEO_SEARCH', 7);
    return results;
  },

  reverseGeocode: async (latitude, longitude) => {
    const lat = Number(latitude);
    const lon = Number(longitude);
    const cacheKey = `reverse_geocode:${lat.toFixed(4)}:${lon.toFixed(4)}`;
    const cached = await CacheManager.getValidCache(cacheKey);
    if (cached) {
      return cached;
    }

    const url = buildUrl(REVERSE_BASE_URL, {
      lat: String(lat),
      lon: String(lon),
      format: 'jsonv2',
      addressdetails: '1',
      zoom: '12',
    });

    const payload = await parseJsonResponse(await fetch(url, { headers: { Accept: 'application/json' } }));
    const result = payload
      ? {
          id: payload.place_id ? String(payload.place_id) : `${lat}_${lon}`,
          label: payload.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
          latitude: lat,
          longitude: lon,
          address: payload.address || {},
        }
      : null;

    if (result) {
      await CacheManager.setCache(cacheKey, result, 'REVERSE_GEOCODE', 30);
    }
    return result;
  },
};
