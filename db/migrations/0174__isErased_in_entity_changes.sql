CREATE TABLE IF NOT EXISTS "mig_entity_changes" (
                                                    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                                    `entityName`	TEXT NOT NULL,
                                                    `entityId`	TEXT NOT NULL,
                                                    `hash`	TEXT NOT NULL,
                                                    `sourceId` TEXT NOT NULL,
                                                    `isErased` INT NOT NULL,
                                                    `utcDateChanged` TEXT NOT NULL,
                                                    `isSynced` INTEGER NOT NULL);

INSERT INTO mig_entity_changes (entityName, entityId, hash, sourceId, isSynced, utcDateChanged, isErased)
SELECT entityName, entityId, '', sourceId, isSynced, 'now', 0 FROM entity_changes;

UPDATE mig_entity_changes SET isErased = (SELECT isErased FROM notes WHERE noteId = entityId) WHERE entityName = 'notes';
UPDATE mig_entity_changes SET utcDateChanged = (SELECT utcDateModified FROM notes WHERE noteId = entityId) WHERE entityName = 'notes';

UPDATE mig_entity_changes SET isErased = (
    SELECT isErased
    FROM attributes
         JOIN notes USING(noteId)
    WHERE attributeId = entityId
) WHERE entityName = 'attributes';
UPDATE mig_entity_changes SET utcDateChanged = (SELECT utcDateModified FROM attributes WHERE attributeId = entityId) WHERE entityName = 'attributes';

UPDATE mig_entity_changes SET isErased = (
    SELECT isErased
    FROM branches
    JOIN notes USING(noteId)
    WHERE branchId = entityId
) WHERE entityName = 'branches';
UPDATE mig_entity_changes SET utcDateChanged = (SELECT utcDateModified FROM branches WHERE branchId = entityId) WHERE entityName = 'branches';

UPDATE mig_entity_changes SET isErased = (
    SELECT isErased
    FROM note_revisions
    WHERE noteRevisionId = entityId
) WHERE entityName = 'note_revisions';
UPDATE mig_entity_changes SET utcDateChanged = (SELECT utcDateModified FROM note_revisions WHERE noteRevisionId = entityId) WHERE entityName = 'note_revisions';

UPDATE mig_entity_changes SET utcDateChanged = (SELECT utcDateCreated FROM api_tokens WHERE apiTokenId = entityId) WHERE entityName = 'api_tokens';

UPDATE mig_entity_changes SET utcDateChanged = (SELECT utcDateModified FROM note_contents WHERE noteId = entityId) WHERE entityName = 'note_contents';

UPDATE mig_entity_changes SET utcDateChanged = (SELECT utcDateModified FROM note_revision_contents WHERE noteRevisionId = entityId) WHERE entityName = 'note_revision_contents';

UPDATE mig_entity_changes SET utcDateChanged = (SELECT utcDateModified FROM options WHERE name = entityId) WHERE entityName = 'options';

UPDATE mig_entity_changes SET utcDateChanged = (SELECT utcDateCreated FROM recent_notes WHERE noteId = entityId) WHERE entityName = 'options';

DROP TABLE entity_changes;
ALTER TABLE mig_entity_changes RENAME TO entity_changes;

CREATE UNIQUE INDEX `IDX_entityChanges_entityName_entityId` ON "entity_changes" (
                                                                                 `entityName`,
                                                                                 `entityId`
    );

DELETE FROM attributes WHERE noteId IN (SELECT noteId FROM notes WHERE isErased = 1);
DELETE FROM branches WHERE noteId IN (SELECT noteId FROM notes WHERE isErased = 1);
DELETE FROM note_contents WHERE noteId IN (SELECT noteId FROM notes WHERE isErased = 1);
DELETE FROM note_revision_contents WHERE noteRevisionId IN (
    SELECT noteRevisionId FROM note_revisions WHERE isErased = 1
);
DELETE FROM note_revisions WHERE isErased = 1;
DELETE FROM notes WHERE isErased = 1;
