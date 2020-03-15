CREATE TABLE IF NOT EXISTS "sync_mig" (
                                          `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                          `entityName`	TEXT NOT NULL,
                                          `entityId`	TEXT NOT NULL,
                                          `sourceId` TEXT NOT NULL,
                                          `isSynced` INTEGER default 0 not null,
                                          `utcSyncDate`	TEXT NOT NULL);

INSERT INTO sync_mig (id, entityName, entityId, sourceId, isSynced, utcSyncDate)
SELECT id, entityName, entityId, sourceId, 1, utcSyncDate FROM sync;

DROP TABLE sync;

ALTER TABLE sync_mig RENAME TO sync;

CREATE UNIQUE INDEX `IDX_sync_entityName_entityId` ON `sync` (
                                                              `entityName`,
                                                              `entityId`
    );
CREATE INDEX `IDX_sync_utcSyncDate` ON `sync` (
                                               `utcSyncDate`
    );