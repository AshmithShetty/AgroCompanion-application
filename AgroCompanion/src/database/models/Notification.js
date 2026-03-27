import { Model } from '@nozbe/watermelondb';
import { text, field, date, readonly } from '@nozbe/watermelondb/decorators';

export class Notification extends Model {
  static table = 'notifications';

  @text('user_id') userId;
  @text('farm_id') farmId;
  @text('session_id') sessionId;
  @text('title') title;
  @text('message') message;
  @text('type') type;
  @text('priority') priority;
  @field('is_read') isRead;
  @readonly @date('created_at') createdAt;
}
