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
    'soil',
    'rainfall',
    'irrigation',
    'crop',
    'rice',
    'paddy',
    'wheat',
    'maize',
    'tomato',
    'apple',
    'pear',
    'plum',
    'banana',
    'arecanut',
    'coconut',
    'pepper',
    'cashew',
    'farming',
    'horticulture',
    'vegetable',
    'pulses',
    'oilseed',
    'flood',
    'drought',
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
