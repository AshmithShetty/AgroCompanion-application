import React, { useEffect, useState } from 'react';
import mqtt from 'mqtt';
import { triggerEvent, updateSensor, triggerReplay, updateSpeed } from './services/api';
import { Scenarios } from './services/scenarios';
import './App.css';

function App() {
  const [farmState, setFarmState] = useState({});
  const [sensorLogs, setSensorLogs] = useState([]);
  const [appLogs, setAppLogs] = useState([]);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    const brokerUrl = import.meta.env.VITE_MQTT_BROKER_URL || 'ws://localhost:3000';
    const client = mqtt.connect(brokerUrl);
    
    client.on('connect', () => {
      client.subscribe('agri/demo_farm/#');
    });

    client.on('message', (topic, message) => {
      const payloadString = message.toString();

      if (topic.includes('app/log')) {
        const payload = JSON.parse(payloadString);
        setAppLogs(prev => {
          const newLogs = [{ time: new Date().toLocaleTimeString(), action: payload.action, detail: payload.detail }, ...prev];
          return newLogs.slice(0, 50);
        });
        return;
      }

      if (topic.includes('sensor')) {
        const payload = JSON.parse(payloadString);
        const key = Object.keys(payload)[0];
        const value = payload[key];

        setFarmState(prev => ({ ...prev, [key]: value }));
        
        setSensorLogs(prev => {
          const newLogs = [{ time: new Date().toLocaleTimeString(), topic: key, value }, ...prev];
          return newLogs.slice(0, 50);
        });
      }
    });

    return () => client.end();
  }, []);

  const handleSliderChange = (sensor, value) => {
    updateSensor(sensor, parseFloat(value));
  };

  const handleSpeedChange = (newSpeed) => {
    setSpeed(newSpeed);
    updateSpeed(newSpeed);
  };

  const sliderConfigs = [
    { key: 'temperature', label: 'Temperature (°C)', min: 10, max: 45, default: 24, step: 0.5 },
    { key: 'humidity', label: 'Humidity (%)', min: 0, max: 100, default: 60, step: 1 },
    { key: 'pressure', label: 'Pressure (hPa)', min: 900, max: 1100, default: 1012, step: 1 },
    { key: 'soil_moisture', label: 'Soil Moisture (%)', min: 0, max: 100, default: 45, step: 1 },
    { key: 'soil_ph', label: 'Soil pH', min: 0, max: 14, default: 6.5, step: 0.1 },
    { key: 'nitrogen', label: 'Nitrogen (mg/kg)', min: 0, max: 300, default: 100, step: 1 },
    { key: 'phosphorus', label: 'Phosphorus (mg/kg)', min: 0, max: 200, default: 50, step: 1 },
    { key: 'potassium', label: 'Potassium (mg/kg)', min: 0, max: 300, default: 120, step: 1 },
    { key: 'light_lux', label: 'Light (lx)', min: 0, max: 100000, default: 45000, step: 1000 }
  ];

  return (
    <div className="container">
      <header className="header">
        <h1>AgroCompanion Demo Controller</h1>
      </header>
      
      <div className="grid">
        <div className="panel">
          <h2>State Dashboard</h2>
          <div className="state-grid">
            {Object.entries(farmState).map(([key, val]) => (
              <div key={key} className="state-card">
                <span className="state-label">{key}</span>
                <span className="state-value">{val}</span>
              </div>
            ))}
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
                <input type="range" min="1" max="10" value={speed} onChange={(e) => handleSpeedChange(e.target.value)} />
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
                    defaultValue={config.default} 
                    onMouseUp={(e) => handleSliderChange(config.key, e.target.value)} 
                  />
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
          <h2>Live AI & App Actions</h2>
          <div className="log-stream app-stream">
            {appLogs.map((log, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">{log.time}</span>
                <span className="log-action">{log.action}</span>
                <span className="log-detail">{log.detail}</span>
              </div>
            ))}
            {appLogs.length === 0 && <span className="log-time">Waiting for mobile app connection...</span>}
          </div>
        </div>

        <div className="panel log-panel">
          <h2>Raw Sensor Telemetry</h2>
          <div className="log-stream">
            {sensorLogs.map((log, i) => (
              <div key={i} className="log-entry">
                <span className="log-time">{log.time}</span>
                <span className="log-topic">{log.topic}</span>
                <span className="log-payload">{log.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;