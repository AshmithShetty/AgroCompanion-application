import { GeoSearchService } from './GeoSearchService';
import { KnowledgeBaseService } from './KnowledgeBaseService';

const DISTRICT_ALIASES = {
  srinagar: ['srinagar'],
  mirzapur: ['mirzapur'],
  agra: ['agra'],
  dharwad: ['dharwad', 'dhArwad', 'dharwar', 'dharwad district'],
  udupi: ['udupi', 'udupi district'],
};

const toRadians = (value) => (value * Math.PI) / 180;

const haversineDistanceKm = (start, end) => {
  const earthRadiusKm = 6371;
  const dLat = toRadians(end.latitude - start.latitude);
  const dLon = toRadians(end.longitude - start.longitude);
  const lat1 = toRadians(start.latitude);
  const lat2 = toRadians(end.latitude);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
};

const extractDistrictTokens = (address = {}) =>
  [
    address.county,
    address.state_district,
    address.district,
    address.city_district,
    address.city,
    address.town,
    address.state,
  ]
    .filter(Boolean)
    .map(value => String(value).toLowerCase());

const getAliasMatch = (tokens = []) => {
  const normalizedTokens = tokens.join(' ');
  const codes = Object.keys(DISTRICT_ALIASES);
  for (let index = 0; index < codes.length; index += 1) {
    const code = codes[index];
    const aliases = DISTRICT_ALIASES[code];
    if (aliases.some(alias => normalizedTokens.includes(alias.toLowerCase()))) {
      return code;
    }
  }
  return null;
};

export const DistrictResolverService = {
  findNearestSupportedDistrict: (coordinate) => {
    const districts = KnowledgeBaseService.listDistricts();
    const ranked = districts
      .map(district => ({
        ...district,
        distanceKm: haversineDistanceKm(coordinate, district.centroid),
      }))
      .sort((left, right) => left.distanceKm - right.distanceKm);

    const nearest = ranked[0];
    return {
      districtCode: nearest.code,
      districtName: nearest.name,
      distanceKm: nearest.distanceKm,
      resolutionMethod: 'nearest_supported_centroid',
    };
  },

  resolveDistrict: async (coordinate) => {
    const reverseGeocode = await GeoSearchService.reverseGeocode(coordinate.latitude, coordinate.longitude).catch(
      () => null
    );
    const addressTokens = extractDistrictTokens(reverseGeocode?.address);
    const aliasMatch = getAliasMatch(addressTokens);

    if (aliasMatch) {
      const district = KnowledgeBaseService.getDistrictByCode(aliasMatch);
      return {
        districtCode: district.code,
        districtName: district.name,
        distanceKm: haversineDistanceKm(coordinate, district.centroid),
        resolutionMethod: 'reverse_geocode_match',
        reverseGeocode,
      };
    }

    const nearest = DistrictResolverService.findNearestSupportedDistrict(coordinate);
    return {
      ...nearest,
      reverseGeocode,
    };
  },
};
