import { ConfigService } from '../../utils/ConfigService';
import { NetworkMonitor } from '../NetworkMonitor';

export const TranslationService = {
  translateArray: async (texts, targetLang, sourceLang = 'auto') => {
    if (!texts || texts.length === 0) return [];

    // Dynamic text translation uses Groq directly (same API style as AIService),
    // so it works in Expo Web without requiring a separate translation microservice.
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
        // fallthrough
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

    // If source and target are the same, short-circuit.
    if (src === tgt && src !== 'auto') return texts;

    const hasWork = cleaned.some((t) => typeof t === 'string' && t.trim() !== '');
    if (!hasWork) return texts;

    const isOnline = await NetworkMonitor.checkConnection();
    if (!isOnline) {
      throw new Error('OFFLINE');
    }

    const systemPrompt = [
      `Translate from ${src === 'auto' ? 'the source language' : langName(src)} to ${langName(tgt)}.`,
      'Return ONLY a valid JSON array of strings.',
      'The array must have the same length and order as the input.',
      'Do not add explanations, markdown, or extra keys.',
    ].join(' ');

    const payload = {
      model: ConfigService.GROQ_TEXT_MODEL,
      temperature: 0,
      max_completion_tokens: 1200,
      stream: false,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: JSON.stringify(cleaned) },
      ],
    };

    const response = await fetch(GROQ_CHAT_URL, {
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
    if (arr.length !== cleaned.length || arr.some((x) => typeof x !== 'string')) {
      throw new Error('GROQ_TRANSLATION_ARRAY_MISMATCH');
    }

    // Preserve non-string inputs exactly as they were.
    return texts.map((orig, i) => (typeof orig === 'string' ? arr[i] : orig));
  }
};
