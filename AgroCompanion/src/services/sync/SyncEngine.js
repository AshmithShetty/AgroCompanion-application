import { EventBusService } from '../EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';
import { QueueManager } from './QueueManager';
import { NetworkMonitor } from '../NetworkMonitor';

export const SyncEngine = {
  init: () => {
    EventBusService.subscribe(EVENT_TOPICS.NETWORK_STATUS_CHANGED, async (data) => {
      if (data && data.isConnected) {
        await SyncEngine.processQueue();
      }
    });
  },

  processQueue: async () => {
    try {
      const isOnline = await NetworkMonitor.checkConnection();
      if (!isOnline) return;

      const pendingItems = await QueueManager.getPending();
      if (!pendingItems || pendingItems.length === 0) return;
      
      for (const item of pendingItems) {
        try {
          const success = await SyncEngine.pushToCloud(item.action, item.payload);
          if (success) {
            await QueueManager.markProcessed(item.id);
          }
        } catch (err) {
          console.error(err);
        }
      }
    } catch (error) {
      console.error(error);
    }
  },

  pushToCloud: async (operation, payload) => {
    return new Promise((resolve) => setTimeout(() => resolve(true), 500));
  }
};