const express = require('express');
const cors = require('cors');
const http = require('http');
const broker = require('./broker');
const Simulator = require('./simulator');
const DataLogger = require('./logger');

const app = express();
app.use(cors());
app.use(express.json());

const apiServer = http.createServer(app);
broker.attachServer(apiServer);

app.post('/sensor/update', (req, res) => {
  const { sensor, value } = req.body;
  if (!sensor || value === undefined) {
    return res.status(400).json({ error: 'Missing sensor or value' });
  }
  Simulator.updateSensor(sensor, value);
  res.json({ success: true, state: Simulator.getState() });
});

app.post('/event/trigger', (req, res) => {
  const { event } = req.body;
  if (!event) {
    return res.status(400).json({ error: 'Missing event name' });
  }
  Simulator.triggerEvent(event);
  res.json({ success: true, state: Simulator.getState() });
});

app.post('/event/replay', async (req, res) => {
  res.json({ success: true, message: 'Replay sequence initiated' });
  await Simulator.replayHistory();
});

app.post('/config/speed', (req, res) => {
  const { speed } = req.body;
  if (!speed) return res.status(400).json({ error: 'Missing speed value' });
  Simulator.setSpeed(speed);
  res.json({ success: true, speed });
});

app.get('/farm/state', (req, res) => {
  res.json(Simulator.getState());
});

app.get('/farm/history', (req, res) => {
  res.json(DataLogger.getHistory());
});

const PORT = process.env.PORT || 3000;

let apiReady = false;
let simulatorStarted = false;

const maybeStartSimulator = () => {
  if (simulatorStarted) return;
  if (!apiReady) return;
  simulatorStarted = true;
  Simulator.start();
};

apiServer.listen(PORT, () => {
  apiReady = true;
  console.log(`Simulation API & MQTT WebSocket broker running on port ${PORT}`);
  maybeStartSimulator();
});
