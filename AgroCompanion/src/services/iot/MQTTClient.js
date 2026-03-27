import mqtt from 'mqtt';
import { ConfigService } from '../../utils/ConfigService';
import { SensorDataParser } from './SensorDataParser';
import { ThresholdManager } from './ThresholdManager';
import { ConnectionManager } from './ConnectionManager';
import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';

let client = null;

export const MQTTClientService = {
  connect: () => {
    if (client && client.connected) return;
    
    client = mqtt.connect(ConfigService.MQTT_BROKER_URL);

    client.on('connect', () => {
      ConnectionManager.resetRetries();
      client.subscribe('agri/+/node/+/sensor/+');
    });

    client.on('message', (topic, message) => {
      const payload = message.toString();
      const parsedData = SensorDataParser.parse(payload);
      
      if (parsedData) {
        ThresholdManager.check(parsedData);
        EventBusService.publish(EVENT_TOPICS.SENSOR_DATA_RECEIVED, { topic, ...parsedData });
      }
    });

    client.on('offline', () => {
      ConnectionManager.handleDisconnect();
    });

    client.on('error', () => {
      client.end();
      ConnectionManager.handleDisconnect();
    });
  },
  
  disconnect: () => {
    if (client) {
      client.end();
      client = null;
    }
  }
};