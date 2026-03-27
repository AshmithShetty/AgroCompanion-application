import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 8,
  tables: [
    tableSchema({
      name: 'users',
      columns: [
        { name: 'username', type: 'string' },
      ]
    }),
    tableSchema({
      name: 'farms',
      columns: [
        { name: 'user_id', type: 'string', isIndexed: true },
        { name: 'name', type: 'string' },
        { name: 'latitude', type: 'number', isOptional: true },
        { name: 'longitude', type: 'number', isOptional: true },
        { name: 'plot_boundaries', type: 'string', isOptional: true },
        { name: 'location_point_json', type: 'string', isOptional: true },
        { name: 'boundary_geojson', type: 'string', isOptional: true },
        { name: 'boundary_bbox_json', type: 'string', isOptional: true },
        { name: 'boundary_area_hectares', type: 'number', isOptional: true },
        { name: 'district_code', type: 'string', isOptional: true },
        { name: 'district_name', type: 'string', isOptional: true },
        { name: 'district_resolution_method', type: 'string', isOptional: true },
        { name: 'knowledge_base_id', type: 'string', isOptional: true },
        { name: 'knowledge_base_version', type: 'string', isOptional: true },
        { name: 'farm_context', type: 'string', isOptional: true },
        { name: 'farm_option_catalog_json', type: 'string', isOptional: true },
        { name: 'context_generated_at', type: 'number', isOptional: true },
        { name: 'context_status', type: 'string', isOptional: true },
        { name: 'satellite_provider', type: 'string', isOptional: true },
        { name: 'satellite_polygon_ref', type: 'string', isOptional: true },
        { name: 'satellite_status', type: 'string', isOptional: true },
        { name: 'satellite_last_synced_at', type: 'number', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'sessions',
      columns: [
        { name: 'farm_id', type: 'string', isIndexed: true },
        { name: 'crop_type', type: 'string' },
        { name: 'seed_variety', type: 'string', isOptional: true },
        { name: 'soil_type', type: 'string', isOptional: true },
        { name: 'start_date', type: 'number', isOptional: true },
        { name: 'farming_method', type: 'string', isOptional: true },
        { name: 'environmental_context', type: 'string', isOptional: true },
        { name: 'farm_context_snapshot', type: 'string', isOptional: true },
        { name: 'option_catalog_snapshot_json', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
      ]
    }),
    tableSchema({
      name: 'notifications',
      columns: [
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'farm_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'session_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'message', type: 'string' },
        { name: 'type', type: 'string', isOptional: true },
        { name: 'priority', type: 'string', isOptional: true },
        { name: 'is_read', type: 'boolean' },
        { name: 'created_at', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'tasks',
      columns: [
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'farm_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'session_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'title', type: 'string' },
        { name: 'date', type: 'string' },
        { name: 'priority', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'source', type: 'string', isOptional: true },
        { name: 'description', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'impact_events',
      columns: [
        { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'farm_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'session_id', type: 'string', isOptional: true, isIndexed: true },
        { name: 'type', type: 'string' },
        { name: 'quantity', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'cost_in_inr', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'source', type: 'string', isOptional: true },
        { name: 'recorded_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'data_cache',
      columns: [
        { name: 'key', type: 'string', isIndexed: true },
        { name: 'value', type: 'string' },
        { name: 'expiry_timestamp', type: 'number' },
        { name: 'type', type: 'string' },
      ]
    }),
    tableSchema({
      name: 'request_queue',
      columns: [
        { name: 'operation', type: 'string' },
        { name: 'payload', type: 'string' },
        { name: 'status', type: 'string' },
        { name: 'retry_count', type: 'number' },
      ]
    }),
    tableSchema({
      name: 'translations',
      columns: [
        { name: 'original_text', type: 'string', isIndexed: true },
        { name: 'language_code', type: 'string', isIndexed: true },
        { name: 'translated_text', type: 'string' },
      ]
    })
  ]
});
