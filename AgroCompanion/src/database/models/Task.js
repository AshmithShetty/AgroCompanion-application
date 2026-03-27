import { Model } from '@nozbe/watermelondb';
import { text } from '@nozbe/watermelondb/decorators';

export class Task extends Model {
  static table = 'tasks';

  @text('user_id') userId;
  @text('farm_id') farmId;
  @text('session_id') sessionId;
  @text('title') title;
  @text('date') date;
  @text('priority') priority;
  @text('status') status;
  @text('source') source;
  @text('description') description;
}
