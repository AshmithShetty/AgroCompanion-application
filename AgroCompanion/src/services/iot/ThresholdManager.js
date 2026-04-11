import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';
import { NotificationService } from '../notifications/NotificationService';
import { NotificationRepository } from '../notifications/NotificationRepository';
import { AppLogger } from './AppLogger';
import { TaskRepository } from '../TaskRepository';
import { useUserSessionStore } from '../../store';
import i18n from 'i18next';

const LABELS = {
  temperature: 'Temperature',
  humidity: 'Humidity',
  pressure: 'Pressure',
  soil_moisture: 'Soil Moisture',
  soil_ph: 'Soil pH',
  nitrogen: 'Nitrogen',
  phosphorus: 'Phosphorus',
  potassium: 'Potassium',
  light_lux: 'Light Level',
  is_raining: 'Rain Detected',
};

let activeThresholds = {
  temperature:   { min: 15, max: 35 },
  humidity:      { min: 30, max: 90 },
  pressure:      { min: 900, max: 1100 },
  soil_moisture: { min: 30, max: 80 },
  soil_ph:       { min: 5.5, max: 7.5 },
  nitrogen:      { min: 50, max: 150 },
  phosphorus:    { min: 20, max: 80 },
  potassium:     { min: 50, max: 200 },
  light_lux:     { min: 2000, max: 100000 },
  is_raining:    { min: 0, max: 0.5 },
};

const lastAlertTime = {};
const ALERT_COOLDOWN_MS = 600000;

export const ThresholdManager = {
  init: () => {
    useUserSessionStore.subscribe(
      (state) => state.currentFarm,
      (currentFarm) => {
        if (!currentFarm || !currentFarm.farmOptionCatalogJson) return;
        try {
          const catalog = JSON.parse(currentFarm.farmOptionCatalogJson);
          if (catalog && catalog.iotThresholds) {
            ThresholdManager.updateThresholdsFromAI(catalog.iotThresholds);
            AppLogger.publish('IoT Limits', 'Active bounds synchronized with personalized AI context.');
          }
        } catch (e) {}
      }
    );
  },

  updateThresholdsFromAI: (newThresholds) => {
    activeThresholds = { ...activeThresholds, ...newThresholds };
  },

  check: (sensorData) => {
    if (!sensorData || !activeThresholds[sensorData.type]) return;

    const rules = activeThresholds[sensorData.type];
    const isBreached = sensorData.value < rules.min || sensorData.value > rules.max;

    if (!isBreached) {
      TaskRepository.resolveTasksBySource(`iot_${sensorData.type}`).catch(() => {});
      return;
    }

    EventBusService.publish(EVENT_TOPICS.SENSOR_THRESHOLD_EXCEEDED, sensorData);

    const now = Date.now();
    const lastAlert = lastAlertTime[sensorData.type] || 0;
    if (now - lastAlert < ALERT_COOLDOWN_MS) return;

    lastAlertTime[sensorData.type] = now;

    const label = LABELS[sensorData.type] || sensorData.type;
    const direction = sensorData.value < rules.min ? 'below minimum' : 'above maximum';
    const limit = sensorData.value < rules.min ? rules.min : rules.max;

    const tTitle = i18n.t(`Alert: ${label} ${direction}`, `Alert: ${label} ${direction}`);
    const tCurrent = i18n.t('Current:', 'Current:');
    const tThreshold = i18n.t('| Threshold:', '| Threshold:');

    AppLogger.publish('Sensor Alert', `${label} ${direction}: ${sensorData.value} (threshold: ${limit})`);

    NotificationService.scheduleLocalNotification(
      tTitle,
      `${tCurrent} ${sensorData.value} ${tThreshold} ${limit}`,
      1
    ).catch(e => console.error('Notification error:', e));

    NotificationRepository.createNotification(
      tTitle,
      `${tCurrent} ${sensorData.value} ${tThreshold} ${limit}`,
      'alert',
      1
    ).catch(e => console.error('Notification DB error:', e));
  }
};