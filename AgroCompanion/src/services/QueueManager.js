import { database } from '../database';

const queueCollection = database.get('request_queue');

export const QueueManager = {
  enqueueOperation: async (operation, payload) => {
    await database.write(async () => {
      await queueCollection.create(record => {
        record.operation = operation;
        record.payload = JSON.stringify(payload);
        record.status = 'Pending';
        record.retry_count = 0;
      });
    });
  },

  getPendingOperations: async () => {
    return await queueCollection.query().fetch();
  }
};