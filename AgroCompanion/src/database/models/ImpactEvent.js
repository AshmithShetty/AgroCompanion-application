import { Model } from '@nozbe/watermelondb';
import { text, field, date, readonly } from '@nozbe/watermelondb/decorators';

export class ImpactEvent extends Model {
  static table = 'impact_events';

  @text('user_id') userId;
  @text('farm_id') farmId;
  @text('session_id') sessionId;
  @text('type') type;
  @field('quantity') quantity;
  @text('unit') unit;
  @field('cost_in_inr') costInInr;
  @text('notes') notes;
  @text('source') source;
  @readonly @date('recorded_at') recordedAt;
}

