import { TranslationService } from './TranslationService';
import { TranslationRepository } from '../TranslationRepository';

class TranslationEngineImpl {
  constructor() {
    this.queue = [];
    this.timeout = null;
    this.cache = new Map();
    this.langCooldownUntil = new Map();
    this.langFailureCount = new Map();
  }

  async warmup(texts, targetLang, sourceLang = 'en') {
    if (!Array.isArray(texts) || texts.length === 0) return;
    if (!targetLang || targetLang === 'en') return;

    const hasEnglishLetters = (str) => typeof str === 'string' && /[a-zA-Z]/.test(str);
    const cleaned = texts.filter(hasEnglishLetters);
    if (cleaned.length === 0) return;

    const cooldownUntil = this.langCooldownUntil.get(targetLang) || 0;
    if (Date.now() < cooldownUntil) return;

    const uniqueTexts = Array.from(new Set(cleaned));
    const results = await TranslationService.translateArray(uniqueTexts, targetLang, sourceLang);

    if (!Array.isArray(results) || results.length !== uniqueTexts.length) {
      throw new Error('TRANSLATION_WARMUP_BAD_RESPONSE');
    }

    for (let i = 0; i < uniqueTexts.length; i++) {
      const original = uniqueTexts[i];
      const translatedRaw = results[i];
      const translated = (typeof translatedRaw === 'string' && translatedRaw.trim() !== '') ? translatedRaw : original;
      if (translated === original) continue;
      if (!this.cache.has(targetLang)) this.cache.set(targetLang, {});
      this.cache.get(targetLang)[original] = translated;
      await TranslationRepository.saveTranslation(original, targetLang, translated);
    }
  }

  translate(textToTranslate, targetLang, callback) {
    if (!textToTranslate || typeof textToTranslate !== 'string') {
      return callback(textToTranslate);
    }

    if (this.cache.has(targetLang) && this.cache.get(targetLang)[textToTranslate]) {
      return callback(this.cache.get(targetLang)[textToTranslate]);
    }

    TranslationRepository.getTranslation(textToTranslate, targetLang).then(dbTrans => {
      if (dbTrans) {
        if (!this.cache.has(targetLang)) this.cache.set(targetLang, {});
        this.cache.get(targetLang)[textToTranslate] = dbTrans;
        callback(dbTrans);
      } else {
        const existing = this.queue.find(i => i.text === textToTranslate && i.lang === targetLang);
        if (existing) {
          existing.callbacks.push(callback);
        } else {
          this.queue.push({ text: textToTranslate, lang: targetLang, callbacks: [callback] });
        }
        
        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.processQueue(), 800);
      }
    });
  }

  async processQueue() {
    if (this.queue.length === 0) return;
    const currentQueue = [...this.queue];
    this.queue = [];

    const byLang = {};
    for (const item of currentQueue) {
      if (!byLang[item.lang]) byLang[item.lang] = [];
      byLang[item.lang].push(item);
    }

    for (const lang of Object.keys(byLang)) {
      const items = byLang[lang];
      const texts = items.map(i => i.text);
      const uniqueTexts = Array.from(new Set(texts));

      try {
        const cooldownUntil = this.langCooldownUntil.get(lang) || 0;
        if (Date.now() < cooldownUntil) {
          items.forEach(item => item.callbacks.forEach(cb => cb(item.text)));
          continue;
        }

        const results = await TranslationService.translateArray(uniqueTexts, lang, 'auto');
        this.langFailureCount.set(lang, 0);
        const resultMap = new Map(uniqueTexts.map((text, index) => [text, results[index]]));

        for (let i = 0; i < texts.length; i++) {
          const original = texts[i];
          const translatedRaw = resultMap.get(original);
          const translated = (typeof translatedRaw === 'string' && translatedRaw.trim() !== '') ? translatedRaw : original;

          if (translated !== original) {
            if (!this.cache.has(lang)) this.cache.set(lang, {});
            this.cache.get(lang)[original] = translated;
            await TranslationRepository.saveTranslation(original, lang, translated);
          }
          
          items[i].callbacks.forEach(cb => cb(translated));
        }
      } catch (e) {
        const prev = this.langFailureCount.get(lang) || 0;
        const next = Math.min(prev + 1, 6);
        this.langFailureCount.set(lang, next);
        const backoffMs = Math.min(30000, 1000 * (2 ** next));
        this.langCooldownUntil.set(lang, Date.now() + backoffMs);
        items.forEach(item => item.callbacks.forEach(cb => cb(item.text)));
      }
    }
  }
}

export const AppTranslator = new TranslationEngineImpl();
