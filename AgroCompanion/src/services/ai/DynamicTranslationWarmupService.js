import { TaskRepository } from '../TaskRepository';
import { AppTranslator } from './TranslationEngine';

const uniq = (arr) => Array.from(new Set(arr.filter(Boolean)));

export const DynamicTranslationWarmupService = {
  warmupOnLanguageChange: async (langCode) => {
    const targetLang = (langCode || '').toLowerCase();
    if (!targetLang || targetLang === 'en') return;

    // Warm up translations for the most common dynamic surfaces (tasks).
    // This batches translations so the UI swaps languages faster after selection.
    try {
      const tasks = await TaskRepository.getAllTasks();
      const slice = tasks.slice(0, 40);
      const texts = [];
      for (const task of slice) {
        if (typeof task?.title === 'string') texts.push(task.title);
        if (typeof task?.description === 'string') texts.push(task.description);
        if (typeof task?.priority === 'string') texts.push(task.priority);
      }
      const uniqueTexts = uniq(texts);
      if (uniqueTexts.length === 0) return;
      await AppTranslator.warmup(uniqueTexts, targetLang);
    } catch {
      // Best-effort only.
    }
  },
};

