import { Model } from '@nozbe/watermelondb';
import { text, field } from '@nozbe/watermelondb/decorators';

export class DataCache extends Model {
  static table = 'data_cache';

  @text('key') key;
  @text('value') value;
  @field('expiry_timestamp') expiryTimestamp;
  @text('type') type;
}
