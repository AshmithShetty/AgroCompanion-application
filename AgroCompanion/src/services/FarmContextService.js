import { CacheManager } from './CacheManager';
import { AIService } from './ai/AIService';
import { KnowledgeBaseService } from './geo/KnowledgeBaseService';

const CROP_CANDIDATES = [
  'Rice', 'Paddy', 'Maize', 'Wheat', 'Tomato', 'Apple', 'Apricot', 'Pear', 'Peach', 'Plum',
  'Cherry', 'Walnut', 'Almond', 'Banana', 'Arecanut', 'Pepper', 'Cashew', 'Coconut', 'Brinjal',
  'Cauliflower', 'Pulses', 'Oilseeds', 'Fodder', 'Ginger', 'Turmeric', 'Potato', 'Onion',
  'Sugarcane', 'Millets', 'Coffee', 'Tea', 'Groundnut', 'Mustard',
];

const SOIL_CANDIDATES = [
  'Clay', 'Clay Loam', 'Sandy Loam', 'Loam', 'Silty Loam', 'Red Loam', 'Laterite',
  'Alluvial', 'Black Soil', 'Gravelly Loam', 'Sandy Clay Loam',
];

const METHOD_CANDIDATES = [
  'Organic', 'Conventional', 'Rainfed', 'Irrigated', 'Intercropping', 'Mixed Cropping',
  'Integrated Pest Management', 'Integrated Nutrient Management', 'Mulching', 'Direct Marketing',
  'Drip Irrigation', 'Proper Drainage',
];

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
    .map(value => (value || '').toString().trim())
    .filter(Boolean))];

  if (normalized.length > 0) {
    return normalized.slice(0, 12);
  }

  return fallback.slice(0, 12);
};

const extractMatches = (markdown, candidates) => {
  const lowerMarkdown = markdown.toLowerCase();
  return candidates.filter(candidate => lowerMarkdown.includes(candidate.toLowerCase()));
};

const buildFallbackProfile = ({ farmName, district, areaHectares, locationPoint }) => {
  const safeDistrict = district || { id: 'general', name: 'the selected district' };
  const knowledge = KnowledgeBaseService.getDistrictKnowledge(safeDistrict.id);
  const markdown = knowledge?.markdown || '';
  const crops = uniqueValues(extractMatches(markdown, CROP_CANDIDATES), ['Rice', 'Maize', 'Tomato']);
  const soils = uniqueValues(extractMatches(markdown, SOIL_CANDIDATES), ['Loam', 'Clay Loam']);
  const methods = uniqueValues(extractMatches(markdown, METHOD_CANDIDATES), DEFAULT_METHODS);
  const locationLabel = locationPoint?.label || `${locationPoint.latitude.toFixed(4)}, ${locationPoint.longitude.toFixed(4)}`;

  return {
    farmContextSummary: `${farmName} is mapped in ${safeDistrict.name}. The farm is approximately ${areaHectares.toFixed(2)} hectares in size near ${locationLabel}. Use the ${safeDistrict.name} district knowledge base as the persistent agronomic reference for this farm.`,
    viableCrops: crops,
    soilTypes: soils,
    farmingMethods: methods,
    districtWarnings: [],
  };
};

const validateProfile = (profile, fallback) => ({
  farmContextSummary: (profile?.farmContextSummary || fallback.farmContextSummary || '').trim(),
  viableCrops: uniqueValues(profile?.viableCrops, fallback.viableCrops),
  soilTypes: uniqueValues(profile?.soilTypes, fallback.soilTypes),
  farmingMethods: uniqueValues(profile?.farmingMethods, fallback.farmingMethods),
  districtWarnings: uniqueValues(profile?.districtWarnings, fallback.districtWarnings || []),
  iotThresholds: profile?.iotThresholds || null,
});

export const FarmContextService = {
  generateFarmProfile: async ({ farmName, locationPoint, areaHectares, district }) => {
    const safeDistrict = district || { id: 'general', name: 'the selected district' };
    const knowledge = KnowledgeBaseService.getDistrictKnowledge(safeDistrict.id);
    const cacheKey = `farm_context:${safeDistrict.id}:${knowledge?.version || 'unknown'}:${locationPoint.latitude.toFixed(4)}:${locationPoint.longitude.toFixed(4)}:${areaHectares.toFixed(2)}`;
    const cached = await CacheManager.getAnyCache(cacheKey);
    if (cached) {
      return cached;
    }

    const fallback = buildFallbackProfile({ farmName, district: safeDistrict, areaHectares, locationPoint });
    if (!knowledge) {
      return fallback;
    }

    const systemPrompt = 'You are an expert agronomist. Respond with strict JSON only. The JSON object must contain farmContextSummary as a string, viableCrops as an array of strings, soilTypes as an array of strings, farmingMethods as an array of strings, districtWarnings as an array of strings, and iotThresholds as an object (containing keys: temperature, humidity, soil_moisture, soil_ph, nitrogen, phosphorus, potassium, light_lux, is_raining with {min, max} numerical properties suitable for this farm).';
    const userPrompt = [
      `Farm name: ${farmName}`,
      `District: ${safeDistrict.name}`,
      `Coordinates: ${locationPoint.latitude}, ${locationPoint.longitude}`,
      `Approximate area in hectares: ${areaHectares.toFixed(2)}`,
      'Use the following district knowledge base extract to determine the best crop, soil, and farming method options for a dropdown-driven farm setup:',
      knowledge.condensedMarkdown,
    ].join('\n\n');

    try {
      const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt);
      const parsed = cleanJsonPayload(rawResponse);
      const validated = validateProfile(parsed, fallback);
      await CacheManager.setCache(cacheKey, validated, 'farm_context', 30);
      return validated;
    } catch (error) {
      await CacheManager.setCache(cacheKey, fallback, 'farm_context', 30);
      return fallback;
    }
  },
};
