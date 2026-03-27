const fs = require('fs');
const path = require('path');

const logFile = path.join(__dirname, 'data_log.json');

const DataLogger = {
  log: (data) => {
    let history = [];
    if (fs.existsSync(logFile)) {
      const fileContent = fs.readFileSync(logFile, 'utf8');
      if (fileContent) {
        history = JSON.parse(fileContent);
      }
    }
    history.push({ timestamp: Date.now(), data });
    fs.writeFileSync(logFile, JSON.stringify(history, null, 2));
  },
  
  getHistory: () => {
    if (fs.existsSync(logFile)) {
      return JSON.parse(fs.readFileSync(logFile, 'utf8'));
    }
    return [];
  }
};

module.exports = DataLogger;