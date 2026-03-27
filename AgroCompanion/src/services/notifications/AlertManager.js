import { Alert } from 'react-native';
import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';
import { NotificationService } from './NotificationService';
import { NotificationRepository } from './NotificationRepository';
import { AutoAgronomistAgent } from '../ai/AutoAgronomistAgent';

export const AlertManager = {
  init: () => {
    EventBusService.subscribe(EVENT_TOPICS.SENSOR_THRESHOLD_EXCEEDED, async (data) => {
      AutoAgronomistAgent.analyzeAnomaly(data);
    });

    EventBusService.subscribe(EVENT_TOPICS.WEATHER_ALERT_CREATED, async (alerts) => {
      for (const alert of alerts) {
        const title = `Weather Warning: ${alert.type}`;
        const message = `Severity: ${alert.severity}. Value recorded: ${alert.value}`;
        
        await NotificationRepository.createNotification(title, message, 'weather', 'high');
        await NotificationService.scheduleLocalNotification(title, message);

        if (alert.severity === 'HIGH') {
          Alert.alert(`CRITICAL: ${title}`, message, [{ text: 'Take Action' }]);
        }
      }
    });
  }
};