INSERT INTO branches (branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, dateModified)
    VALUES ('root', 'root', 'none', 0, null, 1, '2018-01-01T00:00:00.000Z');

INSERT INTO sync (entityName, entityId, sourceId, syncDate)
    VALUES ('branches' ,'root', 'SYNC_FILL', '2018-01-01T00:00:00.000Z');