import { database } from '../database';
import { Q } from '@nozbe/watermelondb';

export const TranslationRepository = {
  getTranslation: async (originalText, languageCode) => {
    try {
      const coll = database.get('translations');
      const records = await coll.query(
        Q.where('original_text', originalText),
        Q.where('language_code', languageCode)
      ).fetch();
      return records.length > 0 ? records[0].translatedText : null;
    } catch {
      return null;
    }
  },

  saveTranslation: async (originalText, languageCode, translatedText) => {
    try {
      const coll = database.get('translations');
      await database.write(async () => {
        const existing = await coll.query(
          Q.where('original_text', originalText),
          Q.where('language_code', languageCode)
        ).fetch();

        if (existing.length > 0) {
          await existing[0].update(rec => {
            rec.translatedText = translatedText;
          });
          return;
        }

        await coll.create(rec => {
          rec.originalText = originalText;
          rec.languageCode = languageCode;
          rec.translatedText = translatedText;
        });
      });
    } catch (e) {
      console.error('Translation string cache DB Error:', e);
    }
  }
};
