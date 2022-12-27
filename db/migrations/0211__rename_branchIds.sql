-- case based on isDeleted is needed, otherwise 2 branches (1 deleted, 1 not) might get the same ID
UPDATE entity_changes SET entityId = COALESCE((
    SELECT
        CASE isDeleted
            WHEN 0 THEN parentNoteId || '_' || noteId
            WHEN 1 THEN branchId
        END
    FROM branches WHERE branchId = entityId
), entityId)
WHERE entityName = 'branches' AND isErased = 0;

UPDATE branches SET branchId = parentNoteId || '_' || noteId WHERE isDeleted = 0;
