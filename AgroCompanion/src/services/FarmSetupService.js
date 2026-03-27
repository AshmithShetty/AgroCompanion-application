import { Q } from '@nozbe/watermelondb';
import { database } from '../database';
import { FarmGeometryService } from './geo/FarmGeometryService';
import { DistrictResolverService } from './geo/DistrictResolverService';
import { KnowledgeBaseService } from './geo/KnowledgeBaseService';
import { FarmContextService } from './FarmContextService';
import { SatelliteService } from './external/SatelliteService';

const getFarmCollection = () => database.get('farms');

const buildLocationPoint = (locationPoint) => ({
  latitude: Number(locationPoint.latitude),
  longitude: Number(locationPoint.longitude),
  label: locationPoint.label || '',
  address: locationPoint.address || '',
  source: locationPoint.source || 'map',
});

const buildFarmGeometry = (locationPoint, polygonPoints) => {
  const normalizedPolygon = FarmGeometryService.normalizePolygonPoints(polygonPoints);
  const geoJson = FarmGeometryService.toGeoJsonPolygon(normalizedPolygon);
  const bbox = FarmGeometryService.computeBoundingBox(normalizedPolygon);
  const areaHectares = FarmGeometryService.computeAreaHectares(normalizedPolygon);
  const centroid = FarmGeometryService.computeCentroid(normalizedPolygon) || locationPoint;
  const validation = FarmGeometryService.validatePolygon(normalizedPolygon, locationPoint);

  return {
    normalizedPolygon,
    geoJson,
    bbox,
    areaHectares,
    centroid,
    validation,
  };
};

const updateFarmRecord = async (farm, payload) => {
  await database.write(async () => {
    await farm.update(record => {
      Object.entries(payload).forEach(([key, value]) => {
        record[key] = value;
      });
    });
  });
  return farm;
};

const fetchFreshFarm = async (farmId) => {
  const collection = getFarmCollection();
  return await collection.find(farmId);
};

const getLegacyPolygonPoints = (farm) => {
  if (!farm?.plotBoundaries) {
    return [];
  }

  try {
    const parsed = JSON.parse(farm.plotBoundaries);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(point => ({
        latitude: Number(point.latitude),
        longitude: Number(point.longitude),
      }))
      .filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
  } catch (error) {
    return [];
  }
};

const buildFarmPayload = ({ farmName, locationPoint, polygonPoints }) => {
  const normalizedLocation = buildLocationPoint(locationPoint);
  const geometry = buildFarmGeometry(normalizedLocation, polygonPoints);

  return {
    geometry,
    payload: {
      name: farmName.trim(),
      latitude: normalizedLocation.latitude,
      longitude: normalizedLocation.longitude,
      plotBoundaries: JSON.stringify(geometry.normalizedPolygon),
      locationPointJson: JSON.stringify(normalizedLocation),
      boundaryGeoJson: JSON.stringify(geometry.geoJson),
      boundaryBboxJson: JSON.stringify(geometry.bbox),
      boundaryAreaHectares: geometry.areaHectares,
      districtCode: '',
      districtName: '',
      districtResolutionMethod: '',
      knowledgeBaseId: '',
      knowledgeBaseVersion: '',
      farmContext: '',
      farmOptionCatalogJson: '',
      contextGeneratedAt: 0,
      contextStatus: 'pending',
      satelliteProvider: '',
      satellitePolygonRef: '',
      satelliteStatus: 'not_registered',
      satelliteLastSyncedAt: 0,
    },
  };
};

export const FarmSetupService = {
  hydrateLegacyFarm: async (farm) => {
    if (!farm) {
      return null;
    }

    const hasLocationPoint = Boolean(farm.locationPointJson);
    const legacyLocation = Number.isFinite(farm.latitude) && Number.isFinite(farm.longitude)
      ? {
          latitude: farm.latitude,
          longitude: farm.longitude,
          label: '',
          address: '',
          source: 'legacy',
        }
      : null;

    const legacyPolygon = getLegacyPolygonPoints(farm);
    const validLegacyPolygon = legacyPolygon.length >= 3 ? legacyPolygon : [];
    const needsHydration = (!hasLocationPoint && legacyLocation) || (!farm.boundaryGeoJson && validLegacyPolygon.length);

    if (!needsHydration) {
      return farm;
    }

    const geometry = validLegacyPolygon.length ? buildFarmGeometry(legacyLocation, validLegacyPolygon) : null;

    await updateFarmRecord(farm, {
      locationPointJson: hasLocationPoint ? farm.locationPointJson : JSON.stringify(legacyLocation),
      boundaryGeoJson: farm.boundaryGeoJson || JSON.stringify(geometry?.geoJson || null),
      boundaryBboxJson: farm.boundaryBboxJson || JSON.stringify(geometry?.bbox || null),
      boundaryAreaHectares: farm.boundaryAreaHectares || geometry?.areaHectares || 0,
      contextStatus: farm.contextStatus || (geometry?.geoJson ? 'pending' : 'failed'),
      satelliteStatus: farm.satelliteStatus || 'not_registered',
    });

    return await fetchFreshFarm(farm.id);
  },

  saveFarmSetup: async ({ currentFarm, userId, farmName, locationPoint, polygonPoints }) => {
    const { geometry, payload } = buildFarmPayload({ farmName, locationPoint, polygonPoints });
    if (!geometry.validation.isValid) {
      throw new Error(geometry.validation.reason);
    }

    const farmsCollection = getFarmCollection();
    let savedFarm;

    await database.write(async () => {
      if (currentFarm) {
        await currentFarm.update(record => {
          record.name = payload.name;
          record.latitude = payload.latitude;
          record.longitude = payload.longitude;
          record.plotBoundaries = payload.plotBoundaries;
          record.locationPointJson = payload.locationPointJson;
          record.boundaryGeoJson = payload.boundaryGeoJson;
          record.boundaryBboxJson = payload.boundaryBboxJson;
          record.boundaryAreaHectares = payload.boundaryAreaHectares;
          record.districtCode = payload.districtCode;
          record.districtName = payload.districtName;
          record.districtResolutionMethod = payload.districtResolutionMethod;
          record.knowledgeBaseId = payload.knowledgeBaseId;
          record.knowledgeBaseVersion = payload.knowledgeBaseVersion;
          record.farmContext = payload.farmContext;
          record.farmOptionCatalogJson = payload.farmOptionCatalogJson;
          record.contextGeneratedAt = payload.contextGeneratedAt;
          record.contextStatus = payload.contextStatus;
          record.satelliteProvider = payload.satelliteProvider;
          record.satellitePolygonRef = payload.satellitePolygonRef;
          record.satelliteStatus = payload.satelliteStatus;
          record.satelliteLastSyncedAt = payload.satelliteLastSyncedAt;
        });
        savedFarm = currentFarm;
      } else {
        savedFarm = await farmsCollection.create(record => {
          record.userId = userId;
          record.name = payload.name;
          record.latitude = payload.latitude;
          record.longitude = payload.longitude;
          record.plotBoundaries = payload.plotBoundaries;
          record.locationPointJson = payload.locationPointJson;
          record.boundaryGeoJson = payload.boundaryGeoJson;
          record.boundaryBboxJson = payload.boundaryBboxJson;
          record.boundaryAreaHectares = payload.boundaryAreaHectares;
          record.districtCode = payload.districtCode;
          record.districtName = payload.districtName;
          record.districtResolutionMethod = payload.districtResolutionMethod;
          record.knowledgeBaseId = payload.knowledgeBaseId;
          record.knowledgeBaseVersion = payload.knowledgeBaseVersion;
          record.farmContext = payload.farmContext;
          record.farmOptionCatalogJson = payload.farmOptionCatalogJson;
          record.contextGeneratedAt = payload.contextGeneratedAt;
          record.contextStatus = payload.contextStatus;
          record.satelliteProvider = payload.satelliteProvider;
          record.satellitePolygonRef = payload.satellitePolygonRef;
          record.satelliteStatus = payload.satelliteStatus;
          record.satelliteLastSyncedAt = payload.satelliteLastSyncedAt;
        });
      }
    });

    return await FarmSetupService.refreshFarmAnalysis(savedFarm.id);
  },

  refreshFarmAnalysis: async (farmId) => {
    const farm = await fetchFreshFarm(farmId);
    const locationPoint = farm.locationPointJson ? JSON.parse(farm.locationPointJson) : null;
    const boundaryGeoJson = farm.boundaryGeoJson ? JSON.parse(farm.boundaryGeoJson) : null;

    if (!locationPoint || !boundaryGeoJson) {
      await updateFarmRecord(farm, { contextStatus: 'failed' });
      return await fetchFreshFarm(farm.id);
    }

    try {
      const district = await DistrictResolverService.resolveDistrict(locationPoint);
      const knowledge = KnowledgeBaseService.getDistrictKnowledge(district?.districtCode);
      const farmProfile = await FarmContextService.generateFarmProfile({
        farmName: farm.name,
        locationPoint,
        areaHectares: Number(farm.boundaryAreaHectares || 0),
        district: {
          id: district?.districtCode,
          name: district?.districtName,
        },
      });

      await updateFarmRecord(farm, {
        districtCode: district?.districtCode || '',
        districtName: district?.districtName || '',
        districtResolutionMethod: district?.resolutionMethod || '',
        knowledgeBaseId: knowledge?.id || '',
        knowledgeBaseVersion: knowledge?.version || '',
        farmContext: farmProfile.farmContextSummary,
        farmOptionCatalogJson: JSON.stringify({
          viableCrops: farmProfile.viableCrops,
          soilTypes: farmProfile.soilTypes,
          farmingMethods: farmProfile.farmingMethods,
          districtWarnings: farmProfile.districtWarnings,
          iotThresholds: farmProfile.iotThresholds,
          generatedAt: Date.now(),
          districtCode: district?.districtCode || '',
          knowledgeBaseId: knowledge?.id || '',
        }),
        contextGeneratedAt: Date.now(),
        contextStatus: 'ready',
      });
    } catch (error) {
      await updateFarmRecord(farm, {
        contextStatus: 'failed',
      });
    }

    let refreshedFarm = await fetchFreshFarm(farm.id);

    try {
      const ndviPayload = await SatelliteService.syncFarmNdvi(refreshedFarm);
      refreshedFarm = await fetchFreshFarm(refreshedFarm.id);
      if (!ndviPayload && refreshedFarm.satelliteStatus !== 'ready') {
        await updateFarmRecord(refreshedFarm, { satelliteStatus: 'failed' });
        refreshedFarm = await fetchFreshFarm(refreshedFarm.id);
      }
    } catch (error) {
      await updateFarmRecord(refreshedFarm, { satelliteStatus: 'failed' });
      refreshedFarm = await fetchFreshFarm(refreshedFarm.id);
    }

    return refreshedFarm;
  },

  getFarmByUserId: async (userId) => {
    const farms = await getFarmCollection().query(Q.where('user_id', userId)).fetch();
    return farms[0] || null;
  },
};
