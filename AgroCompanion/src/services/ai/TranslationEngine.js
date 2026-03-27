import { AzureTranslatorService } from './AzureTranslatorService';
import { TranslationRepository } from '../TranslationRepository';

class TranslationEngineImpl {
  constructor() {
    this.queue = [];
    this.timeout = null;
    this.cache = new Map();
  }

  translate(textToTranslate, targetLang, callback) {
    if (targetLang === 'en' || !textToTranslate || typeof textToTranslate !== 'string') {
      return callback(textToTranslate);
    }

    if (this.cache.has(targetLang) && this.cache.get(targetLang)[textToTranslate]) {
      return callback(this.cache.get(targetLang)[textToTranslate]);
    }

    TranslationRepository.getTranslation(textToTranslate, targetLang).then(dbTrans => {
      if (dbTrans) {
        if (!this.cache.has(targetLang)) this.cache.set(targetLang, {});
        this.cache.get(targetLang)[textToTranslate] = dbTrans;
        console.log(`[AzureTranslator] Cache Hit: "${textToTranslate}" -> "${dbTrans}"`);
        callback(dbTrans);
      } else {
        const existing = this.queue.find(i => i.text === textToTranslate && i.lang === targetLang);
        if (existing) {
          existing.callbacks.push(callback);
        } else {
          this.queue.push({ text: textToTranslate, lang: targetLang, callbacks: [callback] });
        }
        
        if (this.timeout) clearTimeout(this.timeout);
        this.timeout = setTimeout(() => this.processQueue(), 300);
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

      try {
        console.log(`[AzureTranslator] Batch Posting ${texts.length} strings to Cognitive Endpoint...`);
        const results = await AzureTranslatorService.translateArray(texts, lang);
        
        for (let i = 0; i < texts.length; i++) {
          const original = texts[i];
          const translated = results[i];

          if (!this.cache.has(lang)) this.cache.set(lang, {});
          this.cache.get(lang)[original] = translated;
          
          await TranslationRepository.saveTranslation(original, lang, translated);
          
          items[i].callbacks.forEach(cb => cb(translated));
        }
      } catch (e) {
        console.error("[AzureTranslator] API error:", e);
        items.forEach(item => item.callbacks.forEach(cb => cb(item.text)));
      }
    }
  }
}

export const AppTranslator = new TranslationEngineImpl();
