const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'agridata');
const targetDir = path.join(projectRoot, 'src', 'data');
const targetFile = path.join(targetDir, 'districtKnowledgeBase.js');

const districts = [
  { id: 'srinagar', name: 'Srinagar', centroid: { latitude: 34.0837, longitude: 74.7973 } },
  { id: 'mirzapur', name: 'Mirzapur', centroid: { latitude: 25.1460, longitude: 82.5690 } },
  { id: 'agra', name: 'Agra', centroid: { latitude: 27.1767, longitude: 78.0081 } },
  { id: 'dharwad', name: 'Dharwad', centroid: { latitude: 15.4589, longitude: 75.0078 } },
  { id: 'udupi', name: 'Udupi', centroid: { latitude: 13.3409, longitude: 74.7421 } },
];

const normalizeVersion = (stats) => {
  const timestamp = stats.mtime.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `kb-${timestamp}`;
};

const getFileContent = (districtId) => {
  const filePath = path.join(sourceDir, `${districtId}.md`);
  const content = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  const stats = fs.statSync(filePath);
  return {
    content,
    version: normalizeVersion(stats),
  };
};

const output = [
  'export const districtKnowledgeBase = {',
  ...districts.map(({ id, name, centroid }) => {
    const { content, version } = getFileContent(id);
    return `  ${JSON.stringify(id)}: { id: ${JSON.stringify(id)}, name: ${JSON.stringify(name)}, centroid: ${JSON.stringify(centroid)}, version: ${JSON.stringify(version)}, markdown: ${JSON.stringify(content)} },`;
  }),
  '};',
  '',
  'export const supportedDistrictIds = Object.keys(districtKnowledgeBase);',
  '',
  'export const getDistrictKnowledge = (districtId) => districtKnowledgeBase[districtId] || null;',
  '',
].join('\n');

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetFile, output, 'utf8');
