CREATE TABLE IF NOT EXISTS "mig_entity_changes" (
                                                    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                                    `entityName`	TEXT NOT NULL,
                                                    `entityId`	TEXT NOT NULL,
                                                    `hash`	TEXT NOT NULL,
                                                    `sourceId` TEXT NOT NULL,
                                                    `isErased` INT NOT NULL,
                                                    `utcDateChanged` TEXT NOT NULL,
                                                    `isSynced` INTEGER NOT NULL);

INSERT INTO mig_entity_changes (id, entityName, entityId, hash, sourceId, isSynced, utcDateChanged, isErased)
SELECT id, entityName, entityId, '', sourceId, isSynced, utcChangedDate, 0 FROM entity_changes;

UPDATE mig_entity_changes SET isErased = COALESCE((SELECT isErased FROM notes WHERE noteId = entityId), 0) WHERE entityName = 'notes';
UPDATE mig_entity_changes SET utcDateChanged = COALESCE((SELECT utcDateModified FROM notes WHERE noteId = entityId), '2020-12-14 14:07:05.165Z') WHERE entityName = 'notes';

UPDATE mig_entity_changes SET isErased = COALESCE((SELECT isErased FROM notes WHERE noteId = entityId), 0) WHERE entityName = 'note_contents';

UPDATE mig_entity_changes SET isErased = COALESCE((
    SELECT isErased
    FROM attributes
         JOIN notes USING(noteId)
    WHERE attributeId = entityId
), 0) WHERE entityName = 'attributes';
UPDATE mig_entity_changes SET utcDateChanged = COALESCE((SELECT utcDateModified FROM attributes WHERE attributeId = entityId), '2020-12-14 14:07:05.165Z') WHERE entityName = 'attributes';

UPDATE mig_entity_changes SET isErased = COALESCE((
    SELECT isErased
    FROM branches
    JOIN notes USING(noteId)
    WHERE branchId = entityId
), 0) WHERE entityName = 'branches';
UPDATE mig_entity_changes SET utcDateChanged = COALESCE((SELECT utcDateModified FROM branches WHERE branchId = entityId), '2020-12-14 14:07:05.165Z') WHERE entityName = 'branches';

UPDATE mig_entity_changes SET isErased = COALESCE((
    SELECT isErased
    FROM note_revisions
    WHERE noteRevisionId = entityId
), 0) WHERE entityName = 'note_revisions';
UPDATE mig_entity_changes SET utcDateChanged = COALESCE((SELECT utcDateModified FROM note_revisions WHERE noteRevisionId = entityId), '2020-12-14 14:07:05.165Z') WHERE entityName = 'note_revisions';

UPDATE mig_entity_changes SET utcDateChanged = COALESCE((SELECT utcDateCreated FROM api_tokens WHERE apiTokenId = entityId), '2020-12-14 14:07:05.165Z') WHERE entityName = 'api_tokens';

UPDATE mig_entity_changes SET utcDateChanged = COALESCE((SELECT utcDateModified FROM note_contents WHERE noteId = entityId), '2020-12-14 14:07:05.165Z') WHERE entityName = 'note_contents';

UPDATE mig_entity_changes SET utcDateChanged = COALESCE((SELECT utcDateModified FROM note_revision_contents WHERE noteRevisionId = entityId), '2020-12-14 14:07:05.165Z') WHERE entityName = 'note_revision_contents';

UPDATE mig_entity_changes SET utcDateChanged = COALESCE((SELECT utcDateModified FROM options WHERE name = entityId), '2020-12-14 14:07:05.165Z') WHERE entityName = 'options';

UPDATE mig_entity_changes SET utcDateChanged = COALESCE((SELECT utcDateCreated FROM recent_notes WHERE noteId = entityId), '2020-12-14 14:07:05.165Z') WHERE entityName = 'options';

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

UPDATE entity_changes SET isErased = COALESCE((SELECT isErased FROM entity_changes AS sub WHERE sub.entityId = entity_changes.entityId AND sub.entityName = 'note_revisions'), 0) WHERE entityName = 'note_revision_contents';
