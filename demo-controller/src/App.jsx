import React, { useEffect, useRef, useState } from 'react';
import mqtt from 'mqtt';
import { triggerEvent, updateSensor, triggerReplay, updateSpeed } from './services/api';
import { Scenarios } from './services/scenarios';
import './App.css';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const BROKER_URL = import.meta.env.VITE_MQTT_BROKER_URL || 'ws://localhost:3000';

function App() {
  const [farmState, setFarmState] = useState({});
  const [sensorLogs, setSensorLogs] = useState([]);
  const [appLogs, setAppLogs] = useState([]);
  const [speed, setSpeed] = useState(1);
  const [mqttStatus, setMqttStatus] = useState('connecting');
  const pollRef = useRef(null);

  const fetchState = () => {
    fetch(`${BASE_URL}/farm/state`)
      .then(res => res.json())
      .then(data => {
        if (data && typeof data === 'object') {
          setFarmState(data);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    fetchState();

    pollRef.current = setInterval(fetchState, 3000);

    const client = mqtt.connect(BROKER_URL, {
      reconnectPeriod: 2000,
      connectTimeout: 10000,
    });

    client.on('connect', () => {
      setMqttStatus('connected');
      client.subscribe('agri/demo_farm/#', () => {});
    });

    client.on('reconnect', () => {
      setMqttStatus('reconnecting');
    });

    client.on('offline', () => {
      setMqttStatus('offline');
    });

    client.on('error', () => {
      setMqttStatus('error');
    });

    client.on('message', (topic, message) => {
      let payload;
      try {
        payload = JSON.parse(message.toString());
      } catch {
        return;
      }

      if (topic.includes('app/log')) {
        const action = payload.action || '';
        const detail = payload.detail || '';
        setAppLogs(prev => {
          const entry = { time: new Date().toLocaleTimeString(), action, detail };
          return [entry, ...prev].slice(0, 50);
        });
        return;
      }

      if (topic.includes('sensor')) {
        const key = Object.keys(payload)[0];
        if (!key) return;
        const value = payload[key];

        setFarmState(prev => ({ ...prev, [key]: value }));

        setSensorLogs(prev => {
          const entry = { time: new Date().toLocaleTimeString(), topic: key, value };
          return [entry, ...prev].slice(0, 100);
        });
      }
    });

    return () => {
      clearInterval(pollRef.current);
      client.end(true);
    };
  }, []);

  const handleSliderChange = (sensor, value) => {
    const parsed = parseFloat(value);
    updateSensor(sensor, parsed)
      .then(res => {
        if (res && res.state) {
          setFarmState(res.state);
        }
      })
      .catch(() => {});
  };

  const handleSpeedChange = (newSpeed) => {
    setSpeed(Number(newSpeed));
    updateSpeed(newSpeed);
  };

  const sliderConfigs = [
    { key: 'temperature', label: 'Temperature (C)', min: 10, max: 45, default: 24, step: 0.5 },
    { key: 'humidity', label: 'Humidity (%)', min: 0, max: 100, default: 60, step: 1 },
    { key: 'pressure', label: 'Pressure (hPa)', min: 900, max: 1100, default: 1012, step: 1 },
    { key: 'soil_moisture', label: 'Soil Moisture (%)', min: 0, max: 100, default: 45, step: 1 },
    { key: 'soil_ph', label: 'Soil pH', min: 0, max: 14, default: 6.5, step: 0.1 },
    { key: 'nitrogen', label: 'Nitrogen (mg/kg)', min: 0, max: 300, default: 100, step: 1 },
    { key: 'phosphorus', label: 'Phosphorus (mg/kg)', min: 0, max: 200, default: 50, step: 1 },
    { key: 'potassium', label: 'Potassium (mg/kg)', min: 0, max: 300, default: 120, step: 1 },
    { key: 'light_lux', label: 'Light (lx)', min: 0, max: 100000, default: 45000, step: 1000 },
  ];

  const STATUS_COLORS = {
    connected: '#4af626',
    connecting: '#f0c040',
    reconnecting: '#f0a040',
    offline: '#f04040',
    error: '#f04040',
  };

  return (
    <div className="container">
      <header className="header">
        <h1>AgroCompanion Demo Controller</h1>
        <span className="mqtt-badge" style={{ background: STATUS_COLORS[mqttStatus] || '#888' }}>
          MQTT: {mqttStatus}
        </span>
      </header>

      <div className="grid">
        <div className="panel">
          <h2>State Dashboard</h2>
          <div className="state-grid">
            {Object.entries(farmState).map(([key, val]) => (
              <div key={key} className="state-card">
                <span className="state-label">{key.replace(/_/g, ' ')}</span>
                <span className="state-value">
                  {typeof val === 'number' ? val.toFixed(2) : String(val)}
                </span>
              </div>
            ))}
            {Object.keys(farmState).length === 0 && (
              <span className="state-label">Loading...</span>
            )}
          </div>
        </div>

        <div className="panel">
          <h2>Control Panel</h2>
          <div className="controls">
            <button onClick={() => triggerEvent('rain')}>Start Rain</button>
            <button onClick={() => triggerEvent('stop_rain')}>Stop Rain</button>
            <button onClick={() => triggerEvent('nutrient_drop')}>Drop Nutrients</button>
          </div>

          <div className="slider-container">
            <div className="slider-group speed-group">
              <label>Time Speed Multiplier</label>
              <div className="speed-control">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={speed}
                  onChange={(e) => handleSpeedChange(e.target.value)}
                />
                <span>{speed}x</span>
              </div>
            </div>

            <div className="slider-grid">
              {sliderConfigs.map((config) => (
                <div key={config.key} className="slider-group">
                  <label>{config.label}</label>
                  <input
                    type="range"
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    defaultValue={farmState[config.key] !== undefined ? farmState[config.key] : config.default}
                    onMouseUp={(e) => handleSliderChange(config.key, e.target.value)}
                    onTouchEnd={(e) => handleSliderChange(config.key, e.target.value)}
                  />
                  <span className="slider-val">
                    {farmState[config.key] !== undefined ? Number(farmState[config.key]).toFixed(2) : config.default}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <h2>Scenario Runner</h2>
          <div className="controls">
            <button onClick={Scenarios.runPestOutbreak}>Pest Outbreak (Blight)</button>
            <button onClick={Scenarios.runHarvestSale}>Harvest Sale Prep</button>
            <button onClick={triggerReplay}>Replay Logged History</button>
          </div>
        </div>

        <div className="panel log-panel">
          <h2>Live AI &amp; App Actions</h2>
          <div className="log-stream app-stream">
            {appLogs.map((log, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">{log.time}</span>
                <span className="log-action">{log.action}</span>
                <span className="log-detail">{log.detail}</span>
              </div>
            ))}
            {appLogs.length === 0 && (
              <span className="log-time">Waiting for mobile app connection...</span>
            )}
          </div>
        </div>

        <div className="panel log-panel">
          <h2>Raw Sensor Telemetry</h2>
          <div className="log-stream">
            {sensorLogs.map((log, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">{log.time}</span>
                <span className="log-topic">{log.topic}</span>
                <span className="log-payload">{typeof log.value === 'number' ? log.value.toFixed(2) : String(log.value)}</span>
              </div>
            ))}
            {sensorLogs.length === 0 && (
              <span className="log-time">Waiting for sensor data...</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
