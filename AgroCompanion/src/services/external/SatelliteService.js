import { database } from '../../database';
import { CacheManager } from '../CacheManager';
import { NetworkService } from '../NetworkService';
import { ConfigService } from '../../utils/ConfigService';
import { FarmGeometryService } from '../geo/FarmGeometryService';

const API_BASE = 'https://api.agromonitoring.com/agro/1.0';
const CACHE_TTL_DAYS = 30;

const createSvgPreview = ({ title, score, accent }) => {
  const percentage = Math.max(0, Math.min(100, Math.round(((score + 1) / 2) * 100)));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><defs><linearGradient id="g" x1="0%" x2="100%" y1="0%" y2="100%"><stop offset="0%" stop-color="#0f3d1f"/><stop offset="100%" stop-color="${accent}"/></linearGradient></defs><rect width="640" height="360" fill="#0d1b14"/><rect x="24" y="24" width="592" height="312" rx="24" fill="url(#g)" opacity="0.95"/><text x="48" y="88" font-family="Arial" font-size="28" fill="#ffffff">${title}</text><text x="48" y="180" font-family="Arial" font-size="72" font-weight="700" fill="#ffffff">${score.toFixed(2)}</text><text x="48" y="220" font-family="Arial" font-size="24" fill="#d8f5de">NDVI score</text><rect x="48" y="250" width="420" height="20" rx="10" fill="rgba(255,255,255,0.28)"/><rect x="48" y="250" width="${Math.max(24, Math.round((420 * percentage) / 100))}" height="20" rx="10" fill="#ffffff"/><text x="48" y="310" font-family="Arial" font-size="22" fill="#ffffff">${percentage}% vegetation health confidence</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};



const normalizeAgromonitoringUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return value;
  }
  if (value.startsWith('http://api.agromonitoring.com/')) {
    return `https://api.agromonitoring.com/${value.slice('http://api.agromonitoring.com/'.length)}`;
  }
  return value;
};

const fetchWithProtocolFallback = async (url, init) => {
  const primaryUrl = url;
  const secondaryUrl = url.startsWith('https://api.agromonitoring.com/')
    ? `http://api.agromonitoring.com/${url.slice('https://api.agromonitoring.com/'.length)}`
    : url.startsWith('http://api.agromonitoring.com/')
      ? `https://api.agromonitoring.com/${url.slice('http://api.agromonitoring.com/'.length)}`
      : null;

  try {
    return await fetch(primaryUrl, init);
  } catch (error) {
    if (!secondaryUrl) {
      throw error;
    }
    return await fetch(secondaryUrl, init);
  }
};

const parseJson = async (response) => {
  const data = await response.json().catch(() => null);
  return data;
};

const buildPolygonPayload = (farm) => {
  const feature = JSON.parse(farm.boundaryGeoJson);
  return {
    name: farm.name,
    geo_json: feature,
  };
};

const updateFarmSatelliteState = async (farm, values) => {
  await database.write(async () => {
    await farm.update(record => {
      Object.entries(values).forEach(([key, value]) => {
        record[key] = value;
      });
    });
  });
};

const registerPolygon = async (farm) => {
  const url = `${API_BASE}/polygons?appid=${encodeURIComponent(ConfigService.AGROMONITORING_API_KEY)}&duplicated=true`;
  console.log('[Agromonitoring] Registering polygon:', farm.name);
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(buildPolygonPayload(farm)),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.log('[Agromonitoring] Polygon registration failed:', errorText);
    throw new Error(`Polygon registration failed: ${errorText}`);
  }

  const data = await parseJson(response);
  if (!data?.id) {
    throw new Error('Polygon registration did not return an id');
  }

  console.log('[Agromonitoring] Polygon successfully registered:', data.id);
  return data;
};

const searchSatelliteImagery = async (polygonRef, daysBack) => {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (daysBack * 24 * 60 * 60);
  const url = `${API_BASE}/image/search?start=${startDate}&end=${endDate}&polyid=${encodeURIComponent(polygonRef)}&appid=${encodeURIComponent(ConfigService.AGROMONITORING_API_KEY)}`;

  console.log('[Agromonitoring] Searching satellite imagery for polygon:', polygonRef);
  const response = await fetchWithProtocolFallback(url);
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.log(`[Agromonitoring] Satellite imagery search failed (${response.status}):`, errorText);
    return { items: [], status: response.status, errorText };
  }

  const data = await parseJson(response);
  const items = Array.isArray(data) ? data : [];
  console.log(`[Agromonitoring] Found ${items.length} satellite images`);
  return { items, status: 200, errorText: '' };
};

const fetchNdviStats = async (statsUrl) => {
  if (!statsUrl) {
    return null;
  }
  const url = normalizeAgromonitoringUrl(statsUrl);
  const response = await fetchWithProtocolFallback(url);
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.log(`[Agromonitoring] NDVI stats fetch failed (${response.status}):`, errorText);
    return null;
  }
  return await parseJson(response);
};

const fetchNdviHistoryFallback = async (polygonRef, daysBack) => {
  const endDate = Math.floor(Date.now() / 1000);
  const startDate = endDate - (daysBack * 24 * 60 * 60);
  const url = `${API_BASE}/ndvi/history?start=${startDate}&end=${endDate}&polyid=${encodeURIComponent(polygonRef)}&appid=${encodeURIComponent(ConfigService.AGROMONITORING_API_KEY)}`;

  console.log('[Agromonitoring] Fetching NDVI history fallback for polygon:', polygonRef);
  const response = await fetchWithProtocolFallback(url);
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.log(`[Agromonitoring] NDVI history fetch failed (${response.status}):`, errorText);
    return [];
  }

  const data = await parseJson(response);
  return Array.isArray(data) ? data : [];
};

const buildCacheKey = (farm) => {
  const feature = JSON.parse(farm.boundaryGeoJson);
  const polygonHash = FarmGeometryService.hashPolygon(feature);
  return `ndvi:${farm.id}:${polygonHash}`;
};

export const SatelliteService = {
  syncFarmNdvi: async (farm) => {
    if (!farm?.boundaryGeoJson) {
      return null;
    }

    const cacheKey = buildCacheKey(farm);
    const isOnline = await NetworkService.checkConnection();
    const freshCache = await CacheManager.getValidCache(cacheKey);
    if (freshCache) {
      await updateFarmSatelliteState(farm, {
        satelliteProvider: freshCache.provider,
        satellitePolygonRef: freshCache.polygonRef || farm.satellitePolygonRef || '',
        satelliteStatus: freshCache.status || 'ready',
        satelliteLastSyncedAt: Date.now(),
      });
      return freshCache;
    }

    const anyCache = await CacheManager.getAnyCache(cacheKey);
    if (!isOnline && anyCache) {
      await updateFarmSatelliteState(farm, {
        satelliteProvider: anyCache.provider,
        satellitePolygonRef: anyCache.polygonRef || farm.satellitePolygonRef || '',
        satelliteStatus: anyCache.status || 'ready',
        satelliteLastSyncedAt: Date.now(),
      });
      return anyCache;
    }

    if (!ConfigService.AGROMONITORING_API_KEY) {
      throw new Error('Agromonitoring API key is missing.');
    }

    if (!isOnline) {
      if (anyCache) {
        return anyCache;
      }
      throw new Error('No internet connection to fetch satellite data.');
    }

    try {
      let polygonRef = farm.satellitePolygonRef;
      if (!polygonRef) {
        const polygon = await registerPolygon(farm);
        polygonRef = polygon.id;
        await updateFarmSatelliteState(farm, { satellitePolygonRef: polygonRef, satelliteProvider: 'agromonitoring' });
      }

      const search90 = await searchSatelliteImagery(polygonRef, 90);
      const search180 = search90.items.length ? search90 : await searchSatelliteImagery(polygonRef, 180);
      const imagery = search180.items;
      const latestImage = imagery.sort((left, right) => (right.dt || 0) - (left.dt || 0))[0];

      if (!latestImage) {
        const history = await fetchNdviHistoryFallback(polygonRef, 365);
        const latestHistory = history.sort((left, right) => (right.dt || 0) - (left.dt || 0))[0];
        const fallbackMean = Number.isFinite(latestHistory?.data?.mean)
          ? latestHistory.data.mean
          : Number.isFinite(latestHistory?.mean)
            ? latestHistory.mean
            : 0.5;

        const payload = {
          provider: 'agromonitoring',
          polygonRef,
          status: 'no_data',
          observationDate: latestHistory?.dt ? new Date(latestHistory.dt * 1000).toISOString() : new Date().toISOString(),
          ndviMean: fallbackMean,
          previewUrl: createSvgPreview({
            title: `${farm?.districtName || 'Farm'} NDVI`,
            score: fallbackMean,
            accent: '#2f9e44',
          }),
          source: latestHistory?.type || 'fallback',
          stats: latestHistory?.data || null,
        };

        await CacheManager.setCache(cacheKey, payload, 'ndvi_preview', CACHE_TTL_DAYS);
        await updateFarmSatelliteState(farm, {
          satelliteProvider: payload.provider,
          satellitePolygonRef: polygonRef,
          satelliteStatus: payload.status,
          satelliteLastSyncedAt: Date.now(),
        });
        return payload;
      }

      console.log('[Agromonitoring] Processing latest satellite image from:', new Date(latestImage.dt * 1000).toISOString());

      const stats = await fetchNdviStats(latestImage?.stats?.ndvi);
      const meanCandidate = stats?.mean ?? stats?.data?.mean;
      const ndviMean = Number.isFinite(meanCandidate) ? meanCandidate : 0.5;
      const payload = {
        provider: 'agromonitoring',
        polygonRef,
        status: 'ready',
        observationDate: latestImage.dt ? new Date(latestImage.dt * 1000).toISOString() : new Date().toISOString(),
        ndviMean,
        previewUrl: normalizeAgromonitoringUrl(latestImage.image?.truecolor) || normalizeAgromonitoringUrl(latestImage.image?.ndvi) || createSvgPreview({
          title: `${farm?.districtName || 'Farm'} NDVI`,
          score: ndviMean,
          accent: '#2f9e44',
        }),
        source: latestImage.type || 'imagery',
        stats: stats || null,
      };

      await CacheManager.setCache(cacheKey, payload, 'ndvi_preview', CACHE_TTL_DAYS);
      await updateFarmSatelliteState(farm, {
        satelliteProvider: payload.provider,
        satellitePolygonRef: polygonRef,
        satelliteStatus: payload.status,
        satelliteLastSyncedAt: Date.now(),
      });
      return payload;
    } catch (error) {
      if (anyCache) {
        return anyCache;
      }
      const fallbackMean = 0.5;
      const payload = {
        provider: 'agromonitoring',
        polygonRef: farm.satellitePolygonRef || '',
        status: 'failed',
        observationDate: new Date().toISOString(),
        ndviMean: fallbackMean,
        previewUrl: createSvgPreview({
          title: `${farm?.districtName || 'Farm'} NDVI`,
          score: fallbackMean,
          accent: '#2f9e44',
        }),
        source: 'error',
        stats: null,
      };

      await CacheManager.setCache(cacheKey, payload, 'ndvi_preview', CACHE_TTL_DAYS);
      await updateFarmSatelliteState(farm, {
        satelliteProvider: payload.provider,
        satellitePolygonRef: payload.polygonRef || '',
        satelliteStatus: payload.status,
        satelliteLastSyncedAt: Date.now(),
      });
      return payload;
    }
  },

  getFarmNdvi: async (farm) => {
    if (!farm?.boundaryGeoJson) {
      return null;
    }

    const cacheKey = buildCacheKey(farm);
    const cached = await CacheManager.getAnyCache(cacheKey);
    if (cached) {
      return cached;
    }

    return await SatelliteService.syncFarmNdvi(farm);
  },
};
