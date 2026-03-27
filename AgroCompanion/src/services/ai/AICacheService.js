import { CacheManager } from '../CacheManager';
import { hashString } from './PromptUtils';

export const AICacheService = {
  getCachedResponse: async (prompt, context) => {
    const hashKey = `ai_cache_${hashString(prompt + context)}`;
    return await CacheManager.getValidCache(hashKey);
  },
  
  setCachedResponse: async (prompt, context, response) => {
    const hashKey = `ai_cache_${hashString(prompt + context)}`;
    // Cache AI responses for 30 days
    await CacheManager.setCache(hashKey, response, 'AI_RESPONSE', 30); 
  }
};