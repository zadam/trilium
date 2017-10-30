CREATE TABLE `sync` (
	`id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	`entity_name`	TEXT NOT NULL,
	`entity_id`	TEXT NOT NULL,
	`sync_date`	INTEGER NOT NULL
);

CREATE UNIQUE INDEX `IDX_sync_entity_name_id` ON `sync` (
	`entity_name`,
	`entity_id`
);

CREATE INDEX `IDX_sync_sync_date` ON `sync` (
	`sync_date`
);