CREATE TABLE IF NOT EXISTS "mig_entity_changes" (
                                                `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                                `entityName`	TEXT NOT NULL,
                                                `entityId`	TEXT NOT NULL,
                                                `hash`	TEXT NOT NULL,
                                                `isErased` INT NOT NULL,
                                                `changeId` TEXT NOT NULL,
                                                `sourceId` TEXT NOT NULL,
                                                `isSynced` INTEGER NOT NULL,
                                                `utcDateChanged` TEXT NOT NULL
);

INSERT INTO mig_entity_changes (entityName, entityId, hash, isErased, changeId, sourceId, isSynced, utcDateChanged)
    SELECT entityName, entityId, hash, isErased, '', sourceId, isSynced, utcDateChanged FROM entity_changes;

DROP TABLE  entity_changes;

ALTER TABLE mig_entity_changes RENAME TO entity_changes;

CREATE UNIQUE INDEX `IDX_entityChanges_entityName_entityId` ON "entity_changes" (
                                                                                 `entityName`,
                                                                                 `entityId`
    );
