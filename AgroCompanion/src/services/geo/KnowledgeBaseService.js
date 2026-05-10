import { districtKnowledgeBase, getDistrictKnowledge } from '../../data/districtKnowledgeBase';

const stripTags = (value) => value
  .replace(/<[^>]+>/g, ' ')
  .replace(/\|/g, ' ')
  .replace(/\*/g, ' ')
  .replace(/#{1,6}\s*/g, '')
  .replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const buildCondensedKnowledge = (markdown) => {
  const plainText = stripTags(markdown);
  const segments = plainText
    .split(/(?<=[.!?])\s+/)
    .map(segment => segment.trim())
    .filter(Boolean);

  const keywords = [
    'soil', 'rainfall', 'irrigation', 'crop', 'farming', 'horticulture', 'vegetable',
    'pulses', 'oilseed', 'flood', 'drought', 'management', 'sowing', 'variety',
    'cultivar', 'plantation', 'yield', 'productivity', 'season', 'kharif', 'rabi',
    'summer', 'monsoon', 'intercropping', 'mulching', 'fertilizer', 'pesticide',
    'rice', 'paddy', 'wheat', 'maize', 'sorghum', 'pearl millet', 'bajra', 'jowar',
    'finger millet', 'ragi', 'barley', 'gram', 'chickpea', 'pigeon pea', 'tur',
    'black gram', 'green gram', 'lentil', 'pea', 'groundnut', 'soybean', 'sesame',
    'mustard', 'linseed', 'sunflower', 'cotton', 'jute', 'sugarcane', 'tobacco',
    'potato', 'onion', 'tomato', 'brinjal', 'chilli', 'ladies finger', 'bhindi',
    'cabbage', 'cauliflower', 'mango', 'banana', 'citrus', 'guava', 'apple',
    'pear', 'plum', 'peach', 'apricot', 'cherry', 'walnut', 'almond', 'sapota',
    'jackfruit', 'arecanut', 'coconut', 'cashew', 'rubber', 'pepper', 'ginger',
    'turmeric', 'coffee', 'tea'
  ];

  const matchingSegments = [];
  for (const segment of segments) {
    const lowerSegment = segment.toLowerCase();
    if (keywords.some(keyword => lowerSegment.includes(keyword))) {
      matchingSegments.push(segment);
    }
    if (matchingSegments.join(' ').length > 9000) {
      break;
    }
  }

  const condensed = matchingSegments.join(' ').trim();
  return condensed || plainText.slice(0, 9000);
};

export const KnowledgeBaseService = {
  getSupportedDistricts: () => Object.values(districtKnowledgeBase),

  listDistricts: () => Object.values(districtKnowledgeBase),

  getDistrictByCode: (districtId) => districtKnowledgeBase[districtId] || null,

  getDistrictCentroids: () =>
    Object.values(districtKnowledgeBase).map(district => ({
      code: district.id,
      name: district.name,
      centroid: district.centroid,
    })),

  getDistrictKnowledge: (districtId) => {
    const district = getDistrictKnowledge(districtId);
    if (!district) {
      return null;
    }

    return {
      ...district,
      condensedMarkdown: buildCondensedKnowledge(district.markdown),
    };
  },
};
