INSERT OR IGNORE INTO sync (entity_name, entity_id, sync_date, source_id)
  SELECT 'notes', note_id, strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), 'IMPORT' FROM notes;

INSERT OR IGNORE INTO sync (entity_name, entity_id, sync_date, source_id)
  SELECT 'notes_tree', note_tree_id, strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), 'IMPORT' FROM notes_tree;

INSERT OR IGNORE INTO sync (entity_name, entity_id, sync_date, source_id)
  SELECT 'notes_history', note_history_id, strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), 'IMPORT' FROM notes_history;