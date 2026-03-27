import { AGRI_DISTRICTS } from '../data/agridata';

const DISTRICT_LOOKUP = AGRI_DISTRICTS.reduce((accumulator, district) => {
  accumulator[district.code] = district;
  return accumulator;
}, {});

export const KnowledgeBaseService = {
  listDistricts: () => AGRI_DISTRICTS,

  getDistrictByCode: (districtCode) => DISTRICT_LOOKUP[districtCode] || null,

  getDistrictCentroids: () =>
    AGRI_DISTRICTS.map(district => ({
      code: district.code,
      name: district.name,
      centroid: district.centroid,
    })),

  getKnowledgePayload: (districtCode) => {
    const district = KnowledgeBaseService.getDistrictByCode(districtCode);
    if (!district) {
      throw new Error(`Unsupported district: ${districtCode}`);
    }

    return {
      id: district.code,
      name: district.name,
      version: district.version,
      markdown: district.markdown,
      centroid: district.centroid,
      fallbackOptions: district.fallbackOptions,
    };
  },
};
