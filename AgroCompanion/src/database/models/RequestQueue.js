import { Model } from '@nozbe/watermelondb';
import { text, field } from '@nozbe/watermelondb/decorators';

export class RequestQueue extends Model {
  static table = 'request_queue';

  @text('operation') operation;
  @text('payload') payload;
  @text('status') status;
  @field('retry_count') retry_count;
}