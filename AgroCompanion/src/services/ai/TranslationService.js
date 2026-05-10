import { ConfigService } from '../../utils/ConfigService';
import { NetworkMonitor } from '../NetworkMonitor';
import { TranslationRepository } from '../TranslationRepository';
import { AIAuditService } from './AIAuditService';
import { estimateTextTokens, normalizeWhitespace } from './PromptUtils';
import { AIGatekeeper } from './AIGatekeeper';

const translationMemoryCache = new Map();

const getMemoryKey = (text, targetLang) => `${targetLang}::${normalizeWhitespace(text)}`;

const fetchWithRetry = async (url, options, maxRetries = 5) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    const response = await AIGatekeeper.run(() => fetch(url, options));
    if (response.status === 429 || response.status >= 500) {
      attempt++;
      if (attempt >= maxRetries) return response;
      const retryAfter = response.headers.get('Retry-After');
      const baseDelay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * 500;
      const delay = baseDelay + jitter;
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    return response;
  }
};

const getCachedTranslation = async (text, targetLang) => {
  const key = getMemoryKey(text, targetLang);
  if (translationMemoryCache.has(key)) {
    return translationMemoryCache.get(key);
  }
  const fromDb = await TranslationRepository.getTranslation(text, targetLang);
  if (fromDb) {
    translationMemoryCache.set(key, fromDb);
    return fromDb;
  }
  return null;
};

const cacheTranslation = async (text, targetLang, translated) => {
  const key = getMemoryKey(text, targetLang);
  translationMemoryCache.set(key, translated);
  await TranslationRepository.saveTranslation(text, targetLang, translated);
};

export const TranslationService = {
  translateArray: async (texts, targetLang, sourceLang = 'auto') => {
    if (!texts || texts.length === 0) return [];

    if (!ConfigService.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY_MISSING');
    }

    const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

    const langName = (code) => {
      switch ((code || '').toLowerCase()) {
        case 'en': return 'English';
        case 'hi': return 'Hindi';
        case 'kn': return 'Kannada';
        case 'mr': return 'Marathi';
        default: return code || 'unknown';
      }
    };

    const extractJsonArray = (text) => {
      if (typeof text !== 'string') throw new Error('GROQ_BAD_RESPONSE');
      const trimmed = text.trim();
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed;
      } catch {
      }
      const start = trimmed.indexOf('[');
      const end = trimmed.lastIndexOf(']');
      if (start === -1 || end === -1 || end <= start) throw new Error('GROQ_JSON_ARRAY_NOT_FOUND');
      const parsed = JSON.parse(trimmed.slice(start, end + 1));
      if (!Array.isArray(parsed)) throw new Error('GROQ_JSON_ARRAY_NOT_FOUND');
      return parsed;
    };

    const cleaned = texts.map((t) => (typeof t === 'string' ? t : ''));
    const src = (sourceLang || 'auto').toLowerCase();
    const tgt = (targetLang || 'en').toLowerCase();

    if (src === tgt && src !== 'auto') return texts;

    const hasWork = cleaned.some((t) => typeof t === 'string' && t.trim() !== '');
    if (!hasWork) return texts;

    const isOnline = await NetworkMonitor.checkConnection();
    if (!isOnline) {
      throw new Error('OFFLINE');
    }

    const uniqueTexts = Array.from(new Set(cleaned.filter((text) => text.trim() !== '')));
    const translationMap = new Map();
    const misses = [];

    for (const text of uniqueTexts) {
      const cached = await getCachedTranslation(text, tgt);
      if (cached) {
        translationMap.set(text, cached);
      } else {
        misses.push(text);
      }
    }

    if (misses.length === 0) {
      return texts.map((orig) => (typeof orig === 'string' ? (translationMap.get(orig) || orig) : orig));
    }

    const systemPrompt = [
      `Translate from ${src === 'auto' ? 'the source language' : langName(src)} to ${langName(tgt)}.`,
      'Return only a valid JSON array of strings with the same order and length as the input array.',
      'Preserve agronomy terms, numbers, units, dates, product names, and brand names exactly when appropriate.',
      'Do not add explanations, markdown, or extra keys.',
    ].join(' ');
    const promptTokensEstimated = estimateTextTokens(systemPrompt) + estimateTextTokens(JSON.stringify(misses));

    const payload = {
      model: ConfigService.GROQ_TRANSLATION_MODEL,
      temperature: 0,
      max_completion_tokens: Math.max(140, Math.min(1000, Math.round((promptTokensEstimated * 0.9) + 110))),
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(misses) },
      ],
    };

    const response = await fetchWithRetry(GROQ_CHAT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ConfigService.GROQ_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      const msg = err?.error?.message || err?.error || err?.message || response.statusText;
      throw new Error(`GROQ_TRANSLATION_FAILED_${response.status}: ${msg}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    const arr = extractJsonArray(content);
    if (arr.length !== misses.length || arr.some((x) => typeof x !== 'string')) {
      throw new Error('GROQ_TRANSLATION_ARRAY_MISMATCH');
    }

    for (let i = 0; i < misses.length; i++) {
      const original = misses[i];
      const translatedRaw = arr[i];
      const translated = (typeof translatedRaw === 'string' && translatedRaw.trim() !== '') ? translatedRaw : original;
      translationMap.set(original, translated);
      if (translated !== original) {
        await cacheTranslation(original, tgt, translated);
      }
    }

    await AIAuditService.logEvent({
      type: 'ai_request_metric',
      feature: 'translation',
      model: ConfigService.GROQ_TRANSLATION_MODEL,
      cacheHit: misses.length !== uniqueTexts.length,
      promptTokensEstimated,
      completionTokensEstimated: estimateTextTokens(content),
      promptTokensProvider: Number(data?.usage?.prompt_tokens) || 0,
      completionTokensProvider: Number(data?.usage?.completion_tokens) || 0,
      totalTokensProvider: Number(data?.usage?.total_tokens) || 0,
      translatedCount: misses.length,
      cachedCount: uniqueTexts.length - misses.length,
    }).catch(() => {});

    return texts.map((orig) => (typeof orig === 'string' ? (translationMap.get(orig) || orig) : orig));
  }
};
