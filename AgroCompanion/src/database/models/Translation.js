import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export class Translation extends Model {
  static table = 'translations';

  @text('original_text') originalText;
  @text('language_code') languageCode;
  @text('translated_text') translatedText;
}
