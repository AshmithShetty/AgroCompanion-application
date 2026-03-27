const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'node_modules', 'react-native-chart-kit', 'dist', 'AbstractChart.js');

if (fs.existsSync(targetPath)) {
  let content = fs.readFileSync(targetPath, 'utf8');
  if (content.includes('transform-origin')) {
    content = content.replace(/transform-origin/g, 'transformOrigin');
    fs.writeFileSync(targetPath, content, 'utf8');
  }
}
