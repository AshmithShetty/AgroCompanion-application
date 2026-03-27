import { GeoSearchService } from './GeoSearchService';
import { KnowledgeBaseService } from './KnowledgeBaseService';

const toRadians = (value) => (value * Math.PI) / 180;

const haversineDistanceKm = (start, end) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(end.latitude - start.latitude);
  const dLng = toRadians(end.longitude - start.longitude);
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);

  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const normalizeValue = (value) => (value || '').toString().trim().toLowerCase();

const findDistrictFromAddress = (address) => {
  if (!address) {
    return null;
  }

  const supportedDistricts = KnowledgeBaseService.getSupportedDistricts();
  const candidates = [
    address.state_district,
    address.county,
    address.city_district,
    address.city,
    address.town,
    address.state,
  ].map(normalizeValue).filter(Boolean);

  for (const district of supportedDistricts) {
    const districtId = normalizeValue(district.id);
    const districtName = normalizeValue(district.name);
    if (candidates.some(candidate => candidate.includes(districtId) || candidate.includes(districtName))) {
      return district;
    }
  }

  return null;
};

const findNearestDistrict = (point) => {
  const supportedDistricts = KnowledgeBaseService.getSupportedDistricts();
  return supportedDistricts
    .map(district => ({
      district,
      distanceKm: haversineDistanceKm(point, district.centroid),
    }))
    .sort((left, right) => left.distanceKm - right.distanceKm)[0] || null;
};

export const DistrictResolverService = {
  resolveDistrict: async (point) => {
    const reverseResult = await GeoSearchService.reverseGeocode(point);
    const reverseMatch = findDistrictFromAddress(reverseResult?.address);

    if (reverseMatch) {
      return {
        districtCode: reverseMatch.id,
        districtName: reverseMatch.name,
        resolutionMethod: 'reverse_geocode',
        distanceKm: haversineDistanceKm(point, reverseMatch.centroid),
        reverseResult,
      };
    }

    const nearest = findNearestDistrict(point);
    if (!nearest) {
      return null;
    }

    return {
      districtCode: nearest.district.id,
      districtName: nearest.district.name,
      resolutionMethod: 'nearest_supported_centroid',
      distanceKm: nearest.distanceKm,
      reverseResult,
    };
  },
};
