import { CacheManager } from './CacheManager';
import { AIService } from './ai/AIService';
import { KnowledgeBaseService } from './geo/KnowledgeBaseService';

const DEFAULT_METHODS = ['Conventional', 'Organic', 'Integrated Pest Management', 'Integrated Nutrient Management'];

const cleanJsonPayload = (rawText) => {
  if (!rawText || typeof rawText !== 'string') {
    return null;
  }
  const trimmed = rawText.trim();
  const fencedMatch = trimmed.match(/```json\s*([\s\S]+?)```/i) || trimmed.match(/```\s*([\s\S]+?)```/i);
  const candidate = fencedMatch?.[1] || trimmed;
  const firstBrace = candidate.indexOf('{');
  const lastBrace = candidate.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }
  try {
    return JSON.parse(candidate.slice(firstBrace, lastBrace + 1));
  } catch (error) {
    return null;
  }
};

const uniqueValues = (values, fallback) => {
  const normalized = [...new Set((values || [])
    .map(value => {
      if (typeof value === 'object' && value !== null) {
        return `${value.risk || value.type || 'Warning'}: ${value.frequency || value.details || 'Regular'}`;
      }
      return (value || '').toString().trim();
    })
    .filter(Boolean))];
  if (normalized.length > 0) {
    return normalized.slice(0, 20);
  }
  return (fallback || []).slice(0, 12);
};

const buildFallbackProfile = ({ farmName, district, areaHectares, locationPoint }) => {
  const safeDistrict = district || { id: 'general', name: 'the selected district' };
  const knowledge = KnowledgeBaseService.getDistrictKnowledge(safeDistrict.id);
  const catalog = knowledge?.catalog || {};

  return {
    farmContextSummary: `${farmName} is mapped in ${safeDistrict.name}. The farm is approximately ${areaHectares.toFixed(2)} hectares. Information sourced from the official ${safeDistrict.name} agricultural catalog.`,
    viableCrops: catalog.crops || ['Rice', 'Wheat', 'Maize'],
    soilTypes: catalog.soils || ['Loam', 'Sandy Loam'],
    farmingMethods: catalog.methods || DEFAULT_METHODS,
    districtWarnings: [],
  };
};

const validateProfile = (profile, fallback) => {
  const rawIot = profile?.iotThresholds || {};
  const normalizedIot = {};
  const mapping = {
    temperature: 'temperature',
    humidity: 'humidity',
    pressure: 'pressure',
    soilMoisture: 'soil_moisture',
    soil_moisture: 'soil_moisture',
    soilPh: 'soil_ph',
    soil_ph: 'soil_ph',
    nitrogen: 'nitrogen',
    phosphorus: 'phosphorus',
    potassium: 'potassium',
    lightLux: 'light_lux',
    light_lux: 'light_lux',
    isRaining: 'is_raining',
    is_raining: 'is_raining',
    rainfall: 'is_raining'
  };

  Object.entries(rawIot).forEach(([key, val]) => {
    const targetKey = mapping[key];
    if (!targetKey) return;

    if (val && typeof val === 'object' && typeof val.min === 'number' && typeof val.max === 'number') {
      normalizedIot[targetKey] = { min: val.min, max: val.max };
    } else if (typeof val === 'number') {
      normalizedIot[targetKey] = { min: Math.floor(val * 0.8), max: Math.ceil(val * 1.2) };
    }
  });

  return {
    farmContextSummary: (profile?.farmContextSummary || fallback.farmContextSummary || '').trim(),
    viableCrops: uniqueValues(profile?.viableCrops, fallback.viableCrops),
    soilTypes: uniqueValues(profile?.soilTypes, fallback.soilTypes),
    farmingMethods: uniqueValues(profile?.farmingMethods, fallback.farmingMethods),
    districtWarnings: uniqueValues(profile?.districtWarnings, fallback.districtWarnings || []),
    iotThresholds: Object.keys(normalizedIot).length > 0 ? normalizedIot : null,
  };
};

export const FarmContextService = {
  generateFarmProfile: async ({ farmName, locationPoint, areaHectares, district }) => {
    const safeDistrict = district || { id: 'general', name: 'the selected district' };
    const knowledge = KnowledgeBaseService.getDistrictKnowledge(safeDistrict.id);
    const cacheKey = `farm_context_v3:${safeDistrict.id}:${knowledge?.version || 'v3'}:${locationPoint.latitude.toFixed(4)}:${locationPoint.longitude.toFixed(4)}:${areaHectares.toFixed(2)}`;
    const cached = await CacheManager.getAnyCache(cacheKey);
    if (cached) return cached;
    const fallback = buildFallbackProfile({ farmName, district: safeDistrict, areaHectares, locationPoint });
    if (!knowledge) return fallback;

    const catalog = knowledge.catalog || {};
    const systemPrompt = 'You are an expert agronomist. Generate a summary and identify specific warnings for the farm based on the district data. The valid crops, soils, and methods are ALREADY DEFINED in the catalog. Return only one JSON object. Required keys: farmContextSummary, viableCrops (use the provided catalog), soilTypes (use the provided catalog), farmingMethods (use the provided catalog), districtWarnings (array of identified risks), iotThresholds (an object containing ranges for: temperature, humidity, pressure, soil_moisture, soil_ph, nitrogen, phosphorus, potassium, light_lux, is_raining. Each parameter MUST be an object with { min, max } values based on typical agronomic standards for the region and crops. NEVER use single numbers, ALWAYS use { min, max } objects).';
    
    const userPrompt = [
      `Farm: ${farmName}`,
      `District: ${safeDistrict.name}`,
      `Area: ${areaHectares.toFixed(2)} ha`,
      `Catalog Crops: ${catalog.crops?.join(', ')}`,
      `Catalog Soils: ${catalog.soils?.join(', ')}`,
      `Catalog Methods: ${catalog.methods?.join(', ')}`,
      '\nAnalyze this district data to generate a personalized farm summary and identify warnings:',
      knowledge.condensedMarkdown,
    ].join('\n\n');
    try {
      const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt, null, {
        feature: 'farm_profile',
        cacheTtlDays: 30,
      });
      const parsed = cleanJsonPayload(rawResponse);
      const validated = validateProfile(parsed, fallback);
      await CacheManager.setCache(cacheKey, validated, 'farm_context', 30);
      return validated;
    } catch (error) {
      return fallback;
    }
  },
};
