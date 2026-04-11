const mqtt = require('mqtt');
const DataLogger = require('./logger');

let client;
let intervalId;
let isReplaying = false;
let baseInterval = 30000;
let currentSpeed = 1;

let state = {
  temperature: 24,
  humidity: 60,
  pressure: 1012,
  soil_moisture: 45,
  soil_ph: 6.5,
  nitrogen: 100,
  phosphorus: 50,
  potassium: 120,
  light_lux: 45000,
  is_raining: 0
};

const walk = (val, min, max, step) => {
  let newVal = val + (Math.random() * step * 2 - step);
  return Number(Math.max(min, Math.min(max, newVal)).toFixed(2));
};

const generateData = () => {
  if (state.is_raining === 1) {
    state.soil_moisture = walk(state.soil_moisture, 30, 90, 5);
    state.humidity = walk(state.humidity, 70, 100, 2);
    state.temperature = walk(state.temperature, 15, 23, 1);
    state.light_lux = walk(state.light_lux, 2000, 20000, 1000);
  } else {
    state.temperature = walk(state.temperature, 15, 38, 0.5);
    state.humidity = walk(state.humidity, 30, 90, 1);
    state.pressure = walk(state.pressure, 900, 1100, 2);
    state.soil_moisture = walk(state.soil_moisture, 20, 80, 0.5);
    state.light_lux = walk(state.light_lux, 20000, 100000, 5000);
  }

  state.soil_ph = walk(state.soil_ph, 5.0, 8.0, 0.05);
  state.nitrogen = walk(state.nitrogen, 40, 160, 1);
  state.phosphorus = walk(state.phosphorus, 15, 85, 0.5);
  state.potassium = walk(state.potassium, 45, 210, 1);

  return state;
};

const publishState = (skipLogging = false) => {
  const keys = Object.keys(state);
  keys.forEach(key => {
    const payload = JSON.stringify({ [key]: state[key] });
    client.publish(`agri/demo_farm/node/1/sensor/${key}`, payload);
  });
  if (!skipLogging && !isReplaying) {
    DataLogger.log(state);
  }
};

const startLoop = () => {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => {
    if (!isReplaying) {
      generateData();
      publishState();
    }
  }, baseInterval / currentSpeed);
};

const Simulator = {
  start: () => {
    const mqttPort = process.env.PORT || 3000;
    client = mqtt.connect(`ws://127.0.0.1:${mqttPort}`);
    
    client.on('connect', () => {
      console.log(`Simulator successfully connected to internal broker on port ${mqttPort}`);
      publishState();
      startLoop();
    });

    client.on('error', (err) => {
      console.error('Simulator MQTT connection error:', err.message);
    });
  },
  
  stop: () => {
    if (intervalId) clearInterval(intervalId);
    if (client) client.end();
  },
  
  triggerEvent: (eventName) => {
    if (eventName === 'rain') {
      state.is_raining = 1;
    } else if (eventName === 'stop_rain') {
      state.is_raining = 0;
    } else if (eventName === 'nutrient_drop') {
      state.nitrogen = 45;
      state.phosphorus = 18;
      state.potassium = 48;
    }
    publishState();
  },
  
  updateSensor: (sensor, value) => {
    if (state[sensor] !== undefined) {
      state[sensor] = Number(value);
      publishState();
    }
  },

  setSpeed: (multiplier) => {
    currentSpeed = Number(multiplier);
    startLoop();
  },

  replayHistory: async () => {
    const history = DataLogger.getHistory();
    if (!history || history.length === 0) return false;

    isReplaying = true;
    console.log(`Starting demo replay of ${history.length} frames...`);

    for (const entry of history) {
      state = entry.data;
      publishState(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('Demo replay complete. Resuming live simulation.');
    isReplaying = false;
    return true;
  },
  
  getState: () => state
};

module.exports = Simulator;
