DELETE FROM recent_notes;
DELETE FROM sync;

INSERT OR IGNORE INTO sync (entity_name, entity_id, sync_date, source_id)
  SELECT 'notes', note_id, strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), 'IMPORT' FROM notes;

INSERT OR IGNORE INTO sync (entity_name, entity_id, sync_date, source_id)
  SELECT 'notes_tree', note_tree_id, strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), 'IMPORT' FROM notes_tree;

INSERT OR IGNORE INTO sync (entity_name, entity_id, sync_date, source_id)
  SELECT 'notes_history', note_history_id, strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), 'IMPORT' FROM notes_history;

UPDATE options SET opt_value = (SELECT MAX(id) FROM sync) WHERE opt_name IN ('last_synced_push', 'last_synced_pull');