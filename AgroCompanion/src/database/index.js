import { Database } from '@nozbe/watermelondb';
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs';
import { schema } from './schema';
import { migrations } from './migrations';
import { Task } from './models/Task';
import { DataCache } from './models/DataCache';
import { RequestQueue } from './models/RequestQueue';
import { User } from './models/User';
import { Farm } from './models/Farm';
import { Session } from './models/Session';
import { Notification } from './models/Notification';
import { Translation } from './models/Translation';
import { ImpactEvent } from './models/ImpactEvent';
import { ConfigService } from '../utils/ConfigService';
import { DEMO_TASKS } from '../utils/mockData';

const adapter = new LokiJSAdapter({
  schema,
  migrations,
  useWebWorker: false,
  useIncrementalIndexedDB: true,
  onSetUpError: error => {
    console.error("Database initialization failed", error);
  }
});

export const database = new Database({
  adapter,
  modelClasses: [Task, DataCache, RequestQueue, User, Farm, Session, Notification, Translation, ImpactEvent],
});

export const DatabaseService = {
  seedDemoData: async () => {
    if (!ConfigService.DEMO_MODE) return;

    if (!database.collections) {
      console.warn("Database collections not ready for seeding");
      return;
    }

    try {
      const tasksCollection = database.get('tasks');
      const existingTasks = await tasksCollection.query().fetch();

      if (existingTasks.length === 0) {
        await database.write(async () => {
          for (const taskData of DEMO_TASKS) {
            await tasksCollection.create(task => {
              task.title = taskData.title;
              task.date = taskData.date;
              task.priority = taskData.priority;
              task.status = taskData.status;
            });
          }
        });
      }
    } catch (error) {
      console.error("Error seeding demo data:", error);
    }
  }
};
