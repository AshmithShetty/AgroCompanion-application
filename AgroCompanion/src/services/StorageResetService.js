import AsyncStorage from '@react-native-async-storage/async-storage';
import { database } from '../database';
import { CacheManager } from './CacheManager';

const APP_STORAGE_PREFIX = '@agro';
const AUDIT_STORAGE_PREFIX = '@ai_audit';
const LANGUAGE_STORAGE_PREFIX = '@app_language';
const APP_LOG_KEY = 'app_logs';
const LAST_REPORT_PREFIX = '@last_weekly_report';
const FEATURE_USAGE_PREFIX = 'feature_usage_';

const APP_KEY_PREFIXES = [
  APP_STORAGE_PREFIX,
  AUDIT_STORAGE_PREFIX,
  LANGUAGE_STORAGE_PREFIX,
  APP_LOG_KEY,
  LAST_REPORT_PREFIX,
  FEATURE_USAGE_PREFIX,
];

const WATERMELONDB_TABLES = [
  'tasks',
  'data_cache',
  'request_queue',
  'users',
  'farms',
  'sessions',
  'notifications',
  'translations',
  'impact_events',
];

const isAppKey = (key) => {
  return APP_KEY_PREFIXES.some(prefix => key.startsWith(prefix));
};

const clearAsyncStorage = async () => {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    if (!allKeys || allKeys.length === 0) return;
    const appKeys = allKeys.filter(isAppKey);
    if (appKeys.length > 0) {
      await AsyncStorage.multiRemove(appKeys);
    }
  } catch (err) {
    console.error('StorageResetService: failed to clear AsyncStorage', err);
  }
};

const clearWatermelonDB = async () => {
  for (const tableName of WATERMELONDB_TABLES) {
    try {
      const collection = database.get(tableName);
      const allRecords = await collection.query().fetch();
      if (allRecords.length === 0) continue;
      await database.write(async () => {
        const deletions = allRecords.map(record => record.prepareDestroyPermanently());
        await database.batch(...deletions);
      });
    } catch (err) {
      console.error(`StorageResetService: failed to clear table "${tableName}"`, err);
    }
  }
};

export const StorageResetService = {
  resetAll: async () => {
    CacheManager.markResetInProgress();
    try {
      await clearAsyncStorage();
      await clearWatermelonDB();
    } finally {
      CacheManager.markResetComplete();
    }
  },
};
