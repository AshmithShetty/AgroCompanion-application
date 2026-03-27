export const ContextExtractionAgent = {
  generateEnvironmentalContext: async (farm, sessionData) => {
    const district = farm?.districtName || 'the selected district';
    const farmContext = farm?.farmContext || '';
    const cropType = sessionData?.cropType || 'the selected crop';
    const soilType = sessionData?.soilType || 'the selected soil type';
    const farmingMethod = sessionData?.farmingMethod || 'the selected farming method';
    const startDate = sessionData?.startDate ? new Date(sessionData.startDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    return `Farm session context for ${cropType} in ${district}. Soil type: ${soilType}. Farming method: ${farmingMethod}. Start date: ${startDate}. Farm reference context: ${farmContext}`;
  },
};
