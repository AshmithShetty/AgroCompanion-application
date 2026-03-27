import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';

const getQueueCollection = () => {
  try {
    if (!database || !database.collections) return null;
    try {
      return database.collections.get('request_queues');
    } catch (e) {
      return database.collections.get('queues');
    }
  } catch (err) {
    return null;
  }
};

export const QueueManager = {
  addToQueue: async (action, payload) => {
    try {
      const queueCollection = getQueueCollection();
      if (!queueCollection) return;

      await database.write(async () => {
        await queueCollection.create(record => {
          record.action = action;
          record.payload = JSON.stringify(payload);
          record.isProcessed = false;
        });
      });
    } catch (error) {
      console.error(error);
    }
  },

  getPending: async () => {
    try {
      const queueCollection = getQueueCollection();
      if (!queueCollection) return [];
      
      return await queueCollection.query(Q.where('is_processed', false)).fetch();
    } catch (error) {
      return [];
    }
  },

  markProcessed: async (recordId) => {
    try {
      const queueCollection = getQueueCollection();
      if (!queueCollection) return;

      const record = await queueCollection.find(recordId);
      if (!record) return;
      
      await database.write(async () => {
        await record.update(r => {
          r.isProcessed = true;
        });
      });
    } catch (error) {
      console.error(error);
    }
  }
};