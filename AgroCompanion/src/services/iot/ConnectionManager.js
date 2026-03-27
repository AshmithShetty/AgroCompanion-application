import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';

let reconnectAttempts = 0;
const MAX_RETRIES = 5;
const BASE_DELAY = 2000;

export const ConnectionManager = {
  handleDisconnect: () => {
    EventBusService.publish(EVENT_TOPICS.NODE_CONNECTION_LOST, { status: 'disconnected' });
    ConnectionManager.attemptReconnect();
  },

  attemptReconnect: () => {
    if (reconnectAttempts >= MAX_RETRIES) {
      EventBusService.publish(EVENT_TOPICS.NODE_CONNECTION_LOST, { status: 'failed' });
      return;
    }

    const delay = BASE_DELAY * Math.pow(2, reconnectAttempts);
    reconnectAttempts++;

    setTimeout(() => {
      const { MQTTClientService } = require('./MQTTClient');
      MQTTClientService.connect();
    }, delay);
  },

  resetRetries: () => {
    reconnectAttempts = 0;
    EventBusService.publish(EVENT_TOPICS.NODE_CONNECTION_RESTORED, { status: 'connected' });
  }
};