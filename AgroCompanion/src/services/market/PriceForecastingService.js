import { useUserSessionStore } from '../../store';

const CROP_DURATIONS = {
  'Tomato': 90,
  'Wheat': 120,
  'Rice': 120,
  'Paddy': 120,
  'Cotton': 150,
  'Sugarcane': 300,
  'Onion': 100,
  'Potato': 90,
  'Maize': 100,
  'Pearl Millet': 90,
  'Pigeon Pea': 180,
  'Mustard': 110,
  'Chickpea': 110,
  'Groundnut': 120,
  'Soybean': 100,
  'Default': 100
};

const SEASONAL_MULTIPLIERS = {
  'Tomato': [1.1, 1.0, 0.9, 0.8, 1.2, 1.4, 1.5, 1.3, 0.9, 0.8, 1.0, 1.2],
  'Wheat': [1.0, 0.9, 0.8, 0.8, 0.9, 1.0, 1.1, 1.1, 1.2, 1.2, 1.1, 1.0],
  'Rice': [1.0, 1.0, 1.1, 1.1, 1.2, 1.2, 1.1, 1.0, 0.9, 0.9, 0.9, 1.0],
  'Paddy': [1.0, 1.0, 1.1, 1.1, 1.2, 1.2, 1.1, 1.0, 0.9, 0.9, 0.9, 1.0],
  'Onion': [1.2, 1.1, 1.0, 0.9, 0.8, 0.9, 1.1, 1.3, 1.5, 1.6, 1.4, 1.3],
  'Potato': [1.0, 0.9, 0.8, 0.8, 1.0, 1.1, 1.2, 1.3, 1.2, 1.1, 1.0, 0.9],
  'Mustard': [1.1, 1.0, 0.9, 0.8, 0.9, 1.0, 1.1, 1.1, 1.2, 1.3, 1.2, 1.1],
  'Pearl Millet': [1.0, 1.0, 0.9, 0.9, 1.0, 1.1, 1.2, 1.2, 1.1, 1.0, 1.0, 1.0],
  'Pigeon Pea': [1.0, 1.1, 1.2, 1.2, 1.1, 1.0, 0.9, 0.9, 1.0, 1.1, 1.2, 1.1],
  'Default': [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0]
};

const STORAGE_COST_PER_MONTH = 20; 

export const PriceForecastingService = {
  getForecasts: (currentLivePrice, cropType, plantingDateStr, harvestDateOverride = null) => {
    if (!currentLivePrice || isNaN(currentLivePrice)) return null;

    const baseCrop = Object.keys(CROP_DURATIONS).find(c => cropType.toLowerCase().includes(c.toLowerCase())) || 'Default';
    const durationDays = CROP_DURATIONS[baseCrop];
    const multipliers = SEASONAL_MULTIPLIERS[baseCrop] || SEASONAL_MULTIPLIERS['Default'];

    const plantingDate = plantingDateStr ? new Date(plantingDateStr) : new Date();
    
    let harvestDate;
    if (harvestDateOverride) {
      harvestDate = new Date(harvestDateOverride);
    } else {
      harvestDate = new Date(plantingDate);
      harvestDate.setDate(harvestDate.getDate() + durationDays);
    }

    const harvestMonth = harvestDate.getMonth();
    const harvestPlus1Date = new Date(harvestDate);
    harvestPlus1Date.setMonth(harvestPlus1Date.getMonth() + 1);
    const harvestPlus1Month = harvestPlus1Date.getMonth();

    const harvestPlus2Date = new Date(harvestDate);
    harvestPlus2Date.setMonth(harvestPlus2Date.getMonth() + 2);
    const harvestPlus2Month = harvestPlus2Date.getMonth();

    const currentMonth = new Date().getMonth();

    const currentIndex = multipliers[currentMonth];
    
    const calculatePrice = (targetMonthIndex, storageMonths) => {
      const targetIndex = multipliers[targetMonthIndex];
      const rawForecast = currentLivePrice * (targetIndex / currentIndex);
      const netForecast = rawForecast - (STORAGE_COST_PER_MONTH * storageMonths);
      return Math.round(netForecast);
    };

    const formatMonthYear = (d) => d.toLocaleString('default', { month: 'short', year: 'numeric' });

    const forecasts = [
      {
        period: 'Harvest',
        dateStr: formatMonthYear(harvestDate),
        predictedPrice: calculatePrice(harvestMonth, 0),
        storageCostIncluded: 0
      },
      {
        period: 'Harvest + 1 Month',
        dateStr: formatMonthYear(harvestPlus1Date),
        predictedPrice: calculatePrice(harvestPlus1Month, 1),
        storageCostIncluded: STORAGE_COST_PER_MONTH * 1
      },
      {
        period: 'Harvest + 2 Months',
        dateStr: formatMonthYear(harvestPlus2Date),
        predictedPrice: calculatePrice(harvestPlus2Month, 2),
        storageCostIncluded: STORAGE_COST_PER_MONTH * 2
      }
    ];

    return forecasts;
  }
};
