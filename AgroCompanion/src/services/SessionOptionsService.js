const parseCatalog = (catalogJson) => {
  if (!catalogJson) {
    return null;
  }

  try {
    return JSON.parse(catalogJson);
  } catch (error) {
    return null;
  }
};

const normalizeArray = (values) => [...new Set((values || []).map(value => (value || '').toString().trim()).filter(Boolean))];

export const SessionOptionsService = {
  getCatalogForFarm: (farm) => {
    const catalog = parseCatalog(farm?.farmOptionCatalogJson);
    return {
      viableCrops: normalizeArray(catalog?.viableCrops),
      soilTypes: normalizeArray(catalog?.soilTypes),
      farmingMethods: normalizeArray(catalog?.farmingMethods),
      districtWarnings: normalizeArray(catalog?.districtWarnings),
      isReady: Boolean(farm?.contextStatus === 'ready' && normalizeArray(catalog?.viableCrops).length && normalizeArray(catalog?.soilTypes).length && normalizeArray(catalog?.farmingMethods).length),
    };
  },
};
