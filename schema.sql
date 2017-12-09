CREATE TABLE `migrations` (
	`id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	`name`	TEXT NOT NULL,
	`version`	INTEGER NOT NULL,
	`success`	INTEGER NOT NULL,
	`error`	TEXT
);
CREATE TABLE `sync` (
	`id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	`entity_name`	TEXT NOT NULL,
	`entity_id`	TEXT NOT NULL,
	`sync_date`	INTEGER NOT NULL
, source_id TEXT);
CREATE UNIQUE INDEX `IDX_sync_entity_name_id` ON `sync` (
	`entity_name`,
	`entity_id`
);
CREATE INDEX `IDX_sync_sync_date` ON `sync` (
	`sync_date`
);
CREATE TABLE IF NOT EXISTS "options" (
	`opt_name`	TEXT NOT NULL PRIMARY KEY,
	`opt_value`	TEXT,
	`date_modified` INT
);
CREATE TABLE `event_log` (
	`id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	`note_id`	TEXT,
	`comment`	TEXT,
	`date_added`	INTEGER NOT NULL
);
CREATE INDEX `IDX_event_log_date_added` ON `event_log` (
	`date_added`
);
CREATE TABLE IF NOT EXISTS "notes" (
	`note_id`	TEXT NOT NULL,
	`note_title`	TEXT,
	`note_text`	TEXT,
	`date_created`	INT,
	`date_modified`	INT,
	`is_protected`	INT NOT NULL DEFAULT 0,
	`is_deleted`	INT NOT NULL DEFAULT 0,
	PRIMARY KEY(`note_id`)
);
CREATE INDEX `IDX_notes_is_deleted` ON `notes` (
	`is_deleted`
);
CREATE TABLE IF NOT EXISTS "notes_history" (
	`note_history_id`	TEXT NOT NULL PRIMARY KEY,
	`note_id`	TEXT NOT NULL,
	`note_title`	TEXT,
	`note_text`	TEXT,
	`is_protected`	INT,
	`date_modified_from` INT,
	`date_modified_to` INT
);
CREATE INDEX `IDX_notes_history_note_id` ON `notes_history` (
	`note_id`
);
CREATE INDEX `IDX_notes_history_note_date_modified_from` ON `notes_history` (
	`date_modified_from`
);
CREATE INDEX `IDX_notes_history_note_date_modified_to` ON `notes_history` (
	`date_modified_to`
);
CREATE TABLE `source_ids` (
	`source_id`	TEXT NOT NULL,
	`date_created`	INTEGER NOT NULL,
	PRIMARY KEY(`source_id`)
);
CREATE TABLE IF NOT EXISTS "notes_tree" (
    [note_tree_id] VARCHAR(30) PRIMARY KEY NOT NULL,
    [note_id] VARCHAR(30) NOT NULL,
    [note_pid] VARCHAR(30) NOT NULL,
    [note_pos] INTEGER NOT NULL,
    [is_expanded] BOOLEAN NULL ,
    date_modified INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
, `prefix` TEXT);
CREATE INDEX `IDX_notes_tree_note_tree_id` ON `notes_tree` (
	`note_tree_id`
);
CREATE INDEX `IDX_notes_tree_note_id_note_pid` ON `notes_tree` (
	`note_id`,
	`note_pid`
);
CREATE TABLE `recent_notes` (
  'note_tree_id'TEXT NOT NULL PRIMARY KEY,
  `note_path` TEXT NOT NULL,
  `date_accessed` INTEGER NOT NULL ,
  is_deleted INT
);
