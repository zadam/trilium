DROP TABLE entity_changes;
-- not preserving the data because of https://github.com/zadam/trilium/issues/3447

CREATE TABLE IF NOT EXISTS "entity_changes" (
                                                    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                                    `entityName`	TEXT NOT NULL,
                                                    `entityId`	TEXT NOT NULL,
                                                    `hash`	TEXT NOT NULL,
                                                    `isErased` INT NOT NULL,
                                                    `changeId` TEXT NOT NULL,
                                                    `componentId` TEXT NOT NULL,
                                                    `instanceId` TEXT NOT NULL,
                                                    `isSynced` INTEGER NOT NULL,
                                                    `utcDateChanged` TEXT NOT NULL
);

CREATE UNIQUE INDEX `IDX_entityChanges_entityName_entityId` ON "entity_changes" (
                                                                                 `entityName`,
                                                                                 `entityId`
    );
