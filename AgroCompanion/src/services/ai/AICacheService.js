import { CacheManager } from '../CacheManager';
import { hashString } from './PromptUtils';

const normalizeForCache = (value) => (value || '').toString().replace(/\s+/g, ' ').trim();

const historyKey = (historyMessages = []) => historyMessages
  .map(item => `${item.role}:${normalizeForCache(Array.isArray(item.content) ? JSON.stringify(item.content) : item.content)}`)
  .join('|');

const imageKey = (base64Image) => {
  const normalized = normalizeForCache(base64Image);
  if (!normalized) return '';
  return hashString(normalized.slice(0, 2048));
};

const buildCacheKey = (request) => {
  const payload = [
    request?.feature || 'generic',
    request?.model || '',
    request?.responseKind || 'text',
    normalizeForCache(request?.systemPrompt),
    historyKey(request?.historyMessages),
    normalizeForCache(request?.userPrompt),
    imageKey(request?.base64Image),
  ].join('||');
  return `ai_cache_${hashString(payload)}`;
};

export const AICacheService = {
  getCachedResponse: async (request) => {
    const hashKey = buildCacheKey(request);
    return await CacheManager.getValidCache(hashKey);
  },

  setCachedResponse: async (request, response, ttlDays = 30) => {
    const hashKey = buildCacheKey(request);
    await CacheManager.setCache(hashKey, response, 'AI_RESPONSE', ttlDays);
  }
};
