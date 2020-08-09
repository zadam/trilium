CREATE TABLE IF NOT EXISTS "mig_entity_changes" (
                                                `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                                `entityName`	TEXT NOT NULL,
                                                `entityId`	TEXT NOT NULL,
                                                `sourceId` TEXT NOT NULL,
                                                `isSynced` INTEGER default 0 not null,
                                                `utcChangedDate`	TEXT NOT NULL);

INSERT INTO mig_entity_changes (id, entityName, entityId, sourceId, isSynced, utcChangedDate)
    SELECT id, entityName, entityId, sourceId, isSynced, utcSyncDate FROM entity_changes;

DROP TABLE entity_changes;

ALTER TABLE mig_entity_changes RENAME TO entity_changes;

CREATE UNIQUE INDEX `IDX_entityChanges_entityName_entityId` ON "entity_changes" (
                                                                                 `entityName`,
                                                                                 `entityId`
    );
CREATE INDEX `IDX_entityChanges_utcChangedDate` ON "entity_changes" (
                                                                  `utcChangedDate`
    );
