import { Model } from '@nozbe/watermelondb';
import { text, field, date } from '@nozbe/watermelondb/decorators';

export class Session extends Model {
  static table = 'sessions';

  @text('farm_id') farmId;
  @text('crop_type') cropType;
  @text('seed_variety') seedVariety;
  @text('soil_type') soilType;
  @date('start_date') startDate;
  @text('farming_method') farmingMethod;
  @text('environmental_context') environmentalContext;
  @text('farm_context_snapshot') farmContextSnapshot;
  @text('option_catalog_snapshot_json') optionCatalogSnapshotJson;
  @field('is_active') isActive;
}
