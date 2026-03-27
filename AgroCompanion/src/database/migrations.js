import { schemaMigrations, addColumns, createTable } from '@nozbe/watermelondb/Schema/migrations';

export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 5,
      steps: [
        addColumns({
          table: 'farms',
          columns: [
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
          ],
        }),
        addColumns({
          table: 'sessions',
          columns: [
            { name: 'farm_context_snapshot', type: 'string', isOptional: true },
            { name: 'option_catalog_snapshot_json', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 6,
      steps: [
        addColumns({
          table: 'tasks',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'farm_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'session_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
        addColumns({
          table: 'notifications',
          columns: [
            { name: 'user_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'farm_id', type: 'string', isOptional: true, isIndexed: true },
            { name: 'session_id', type: 'string', isOptional: true, isIndexed: true },
          ],
        }),
      ],
    },
    {
      toVersion: 7,
      steps: [
        createTable({
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
      ],
    },
    {
      toVersion: 8,
      steps: [
        addColumns({
          table: 'tasks',
          columns: [
            { name: 'description', type: 'string', isOptional: true },
          ],
        }),
      ],
    },
  ],
});
