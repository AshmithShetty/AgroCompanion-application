import { ConfigService } from '../../utils/ConfigService';
import mqtt from 'mqtt';

let client = null;
let isConnected = false;

const getClient = () => {
  if (client && isConnected) return client;
  return null;
};

export const AppLogger = {
  connect: () => {
    if (client && isConnected) return;
    try {
      client = mqtt.connect(ConfigService.MQTT_BROKER_URL);
      client.on('connect', () => {
        isConnected = true;
      });
      client.on('offline', () => { isConnected = false; });
      client.on('error', () => { isConnected = false; });
    } catch (e) {
      console.warn('AppLogger MQTT connection failed:', e.message);
    }
  },

  publish: (action, detail = '') => {
    const c = getClient();
    if (!c) return;
    try {
      const payload = JSON.stringify({ action, detail, ts: Date.now() });
      c.publish('agri/demo_farm/app/log', payload);
    } catch (e) {
      console.warn('AppLogger publish failed:', e.message);
    }
  }
};
