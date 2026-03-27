import { database } from '../database';

export const DemoDataService = {
  resetToDemoState: async () => {
    await database.write(async () => {
      const collections = ['tasks', 'notifications', 'data_caches', 'request_queues'];
      for (const collectionName of collections) {
        const collection = database.get(collectionName);
        const allRecords = await collection.query().fetch();
        const deleted = allRecords.map(record => record.prepareDestroyPermanently());
        await database.batch(...deleted);
      }
    });
  }
};