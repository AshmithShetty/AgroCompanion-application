import { database } from '../database';
import { Q } from '@nozbe/watermelondb';

export const CacheManager = {
  setCache: async (key, value, type, ttlDays) => {
    const cacheCollection = database.get('data_cache');
    const expiry = Date.now() + (ttlDays * 24 * 60 * 60 * 1000);

    await database.write(async () => {
      const existing = await cacheCollection.query(Q.where('key', key)).fetch();
      if (existing.length > 0) {
        await existing[0].update(record => {
          record.value = JSON.stringify(value);
          record.expiryTimestamp = expiry;
          record.type = type;
        });
      } else {
        await cacheCollection.create(record => {
          record.key = key;
          record.value = JSON.stringify(value);
          record.expiryTimestamp = expiry;
          record.type = type;
        });
      }
    });
  },

  getCacheRecord: async (key) => {
    const cacheCollection = database.get('data_cache');
    const results = await cacheCollection.query(Q.where('key', key)).fetch();
    return results[0] || null;
  },

  getValidCache: async (key) => {
    const record = await CacheManager.getCacheRecord(key);
    if (record && Date.now() < record.expiryTimestamp) {
      try {
        return JSON.parse(record.value);
      } catch (error) {
        return null;
      }
    }
    return null;
  },

  getAnyCache: async (key) => {
    const record = await CacheManager.getCacheRecord(key);
    if (record) {
      try {
        return JSON.parse(record.value);
      } catch (error) {
        return null;
      }
    }
    return null;
  },

  removeCache: async (key) => {
    const cacheCollection = database.get('data_cache');
    const results = await cacheCollection.query(Q.where('key', key)).fetch();
    if (results.length === 0) {
      return;
    }

    await database.write(async () => {
      const deletions = results.map(record => record.prepareDestroyPermanently());
      await database.batch(...deletions);
    });
  },

  isFresh: async (key) => {
    const record = await CacheManager.getCacheRecord(key);
    if (!record) {
      return false;
    }
    return Date.now() < record.expiryTimestamp;
  },

  preCacheMapTiles: async (regionCoordinates) => {
    const tileKey = `map_tiles_${regionCoordinates}`;
    await CacheManager.setCache(tileKey, 'tile_binary_data_placeholder', 'MAP_TILE', 30);
  }
};
