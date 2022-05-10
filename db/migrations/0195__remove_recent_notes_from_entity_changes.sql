-- removing potential remnants of recent notes in entity changes, see https://github.com/zadam/trilium/issues/2842
DELETE FROM entity_changes WHERE entityName = 'recent_notes';
