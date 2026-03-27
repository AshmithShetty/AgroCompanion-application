import { Model } from '@nozbe/watermelondb';
import { text, field } from '@nozbe/watermelondb/decorators';

export class Farm extends Model {
  static table = 'farms';

  @text('user_id') userId;
  @text('name') name;
  @field('latitude') latitude;
  @field('longitude') longitude;
  @text('plot_boundaries') plotBoundaries;
  @text('location_point_json') locationPointJson;
  @text('boundary_geojson') boundaryGeoJson;
  @text('boundary_bbox_json') boundaryBboxJson;
  @field('boundary_area_hectares') boundaryAreaHectares;
  @text('district_code') districtCode;
  @text('district_name') districtName;
  @text('district_resolution_method') districtResolutionMethod;
  @text('knowledge_base_id') knowledgeBaseId;
  @text('knowledge_base_version') knowledgeBaseVersion;
  @text('farm_context') farmContext;
  @text('farm_option_catalog_json') farmOptionCatalogJson;
  @field('context_generated_at') contextGeneratedAt;
  @text('context_status') contextStatus;
  @text('satellite_provider') satelliteProvider;
  @text('satellite_polygon_ref') satellitePolygonRef;
  @text('satellite_status') satelliteStatus;
  @field('satellite_last_synced_at') satelliteLastSyncedAt;
}
