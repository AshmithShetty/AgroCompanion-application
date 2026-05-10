import { Model } from '@nozbe/watermelondb';
import { text, field, date, readonly } from '@nozbe/watermelondb/decorators';

export class SensorLog extends Model {
  static table = 'sensor_logs';

  @text('farm_id') farmId;
  @text('type') type;
  @field('value') value;
  @readonly @date('recorded_at') recordedAt;
}
