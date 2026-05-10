import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';
import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';
import { useUserSessionStore } from '../../store';

class SensorHistoryServiceImpl {
  init() {
    EventBusService.subscribe(EVENT_TOPICS.SENSOR_DATA_RECEIVED, async (data) => {
      await this.logSensorData(data);
    });
  }

  async logSensorData(data) {
    const { currentFarm } = useUserSessionStore.getState();
    const farmId = currentFarm?.id;
    if (!farmId) return;

    const sensorEntries = Object.entries(data).filter(([key, val]) => 
      !['topic', 'capturedAt'].includes(key) && typeof val === 'number'
    );

    if (sensorEntries.length === 0) return;

    await database.write(async () => {
      const collection = database.get('sensor_logs');
      for (const [type, value] of sensorEntries) {
        await collection.create(record => {
          record.farmId = farmId;
          record.type = type;
          record.value = value;
          record._raw.recorded_at = Date.now();
        });
      }
    });
  }

  async get7DayAverages(farmIdOverride = null) {
    const { currentFarm } = useUserSessionStore.getState();
    const farmId = farmIdOverride || currentFarm?.id;
    if (!farmId) return {};

    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const collection = database.get('sensor_logs');
    
    const logs = await collection.query(
      Q.where('farm_id', farmId),
      Q.where('recorded_at', Q.gt(sevenDaysAgo))
    ).fetch();

    if (!logs || logs.length === 0) return {};

    const aggregates = {};
    for (const log of logs) {
      if (!aggregates[log.type]) {
        aggregates[log.type] = { sum: 0, count: 0 };
      }
      aggregates[log.type].sum += log.value;
      aggregates[log.type].count += 1;
    }

    const averages = {};
    for (const [type, data] of Object.entries(aggregates)) {
      averages[type] = Math.round((data.sum / data.count) * 100) / 100;
    }

    return averages;
  }
}

export const SensorHistoryService = new SensorHistoryServiceImpl();
