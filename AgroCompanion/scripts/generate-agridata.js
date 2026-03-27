const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '..');
const sourceDir = path.join(rootDir, 'agridata');
const outputDir = path.join(rootDir, 'src', 'data');
const outputFile = path.join(outputDir, 'agridata.js');

const configs = [
  {
    code: 'srinagar',
    name: 'Srinagar',
    centroid: { latitude: 34.0837, longitude: 74.7973 },
    fallbackOptions: {
      viableCrops: ['Rice', 'Maize', 'Apple', 'Saffron', 'Walnut'],
      soilTypes: ['Clay Loam', 'Silty Clay', 'Alluvial Soil'],
      farmingMethods: ['Conventional', 'Integrated Farming', 'Organic'],
      districtWarnings: ['Frost risk during cold season', 'Plan for cool-climate crop windows'],
    },
  },
  {
    code: 'mirzapur',
    name: 'Mirzapur',
    centroid: { latitude: 25.146, longitude: 82.569 },
    fallbackOptions: {
      viableCrops: ['Wheat', 'Paddy', 'Gram', 'Mustard', 'Pigeon Pea'],
      soilTypes: ['Alluvial Soil', 'Loam', 'Clay Loam'],
      farmingMethods: ['Conventional', 'Integrated Farming', 'Rainfed Farming'],
      districtWarnings: ['Heat stress may affect late planting', 'Water planning is important in dry spells'],
    },
  },
  {
    code: 'agra',
    name: 'Agra',
    centroid: { latitude: 27.1767, longitude: 78.0081 },
    fallbackOptions: {
      viableCrops: ['Wheat', 'Potato', 'Mustard', 'Pearl Millet', 'Guava'],
      soilTypes: ['Alluvial Soil', 'Sandy Loam', 'Loam'],
      farmingMethods: ['Conventional', 'Drip Irrigation', 'Integrated Farming'],
      districtWarnings: ['High summer temperatures require irrigation planning', 'Avoid water-intensive crops in stressed periods'],
    },
  },
  {
    code: 'dharwad',
    name: 'Dharwad',
    centroid: { latitude: 15.4589, longitude: 75.0078 },
    fallbackOptions: {
      viableCrops: ['Maize', 'Groundnut', 'Cotton', 'Tur', 'Chilli'],
      soilTypes: ['Red Soil', 'Black Soil', 'Loam'],
      farmingMethods: ['Conventional', 'Integrated Farming', 'Organic'],
      districtWarnings: ['Monsoon timing strongly affects scheduling', 'Monitor soil moisture variability'],
    },
  },
  {
    code: 'udupi',
    name: 'Udupi',
    centroid: { latitude: 13.3409, longitude: 74.7421 },
    fallbackOptions: {
      viableCrops: ['Paddy', 'Coconut', 'Arecanut', 'Banana', 'Black Pepper'],
      soilTypes: ['Laterite Soil', 'Coastal Alluvial Soil', 'Loam'],
      farmingMethods: ['Organic', 'Integrated Farming', 'Mixed Cropping'],
      districtWarnings: ['Heavy rainfall can affect disease pressure', 'Coastal humidity may increase fungal risk'],
    },
  },
];

fs.mkdirSync(outputDir, { recursive: true });

const serializedDistricts = configs
  .map((config) => {
    const markdown = fs.readFileSync(path.join(sourceDir, `${config.code}.md`), 'utf8');
    return {
      ...config,
      version: '2026-hackathon',
      markdown,
    };
  })
  .map((district) => JSON.stringify(district, null, 2))
  .join(',\n');

const contents = `export const AGRI_DISTRICTS = [
${serializedDistricts}
];

export const AGRI_DISTRICT_MAP = AGRI_DISTRICTS.reduce((accumulator, district) => {
  accumulator[district.code] = district;
  return accumulator;
}, {});
`;

fs.writeFileSync(outputFile, contents);
