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

INSERT INTO mig_entity_changes (id, entityName, entityId, hash, isErased, changeId, sourceId, isSynced, utcDateChanged)
    SELECT id, entityName, entityId, hash, isErased, '', sourceId, isSynced, utcDateChanged FROM entity_changes;

-- delete duplicates https://github.com/zadam/trilium/issues/2534
DELETE FROM mig_entity_changes WHERE isErased = 0 AND id IN (
    SELECT id FROM mig_entity_changes ec
    WHERE (
              SELECT COUNT(*) FROM mig_entity_changes
              WHERE ec.entityName = mig_entity_changes.entityName
                AND ec.entityId = mig_entity_changes.entityId
          ) > 1
);

DROP TABLE entity_changes;

ALTER TABLE mig_entity_changes RENAME TO entity_changes;

CREATE UNIQUE INDEX `IDX_entityChanges_entityName_entityId` ON "entity_changes" (
                                                                                 `entityName`,
                                                                                 `entityId`
    );
