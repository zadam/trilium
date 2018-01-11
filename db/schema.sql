CREATE TABLE IF NOT EXISTS "options" (
	`opt_name`	TEXT NOT NULL PRIMARY KEY,
	`opt_value`	TEXT,
	`date_modified` INT
);
CREATE TABLE IF NOT EXISTS "sync" (
    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    `entity_name`	TEXT NOT NULL,
    `entity_id`	TEXT NOT NULL,
    `source_id` TEXT NOT NULL,
    `sync_date`	TEXT NOT NULL);
CREATE TABLE `source_ids` (
  `source_id`	TEXT NOT NULL,
  `date_created`	TEXT NOT NULL,
  PRIMARY KEY(`source_id`)
);
CREATE TABLE IF NOT EXISTS "notes" (
    `note_id`	TEXT NOT NULL,
    `note_title`	TEXT,
    `note_text`	TEXT,
    `is_protected`	INT NOT NULL DEFAULT 0,
    `is_deleted`	INT NOT NULL DEFAULT 0,
    `date_created`	TEXT NOT NULL,
    `date_modified`	TEXT NOT NULL,
    PRIMARY KEY(`note_id`)
);
CREATE TABLE `event_log` (
    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    `note_id`	TEXT,
    `comment`	TEXT,
    `date_added`	TEXT NOT NULL,
    FOREIGN KEY(note_id) REFERENCES notes(note_id)
);
CREATE TABLE IF NOT EXISTS "notes_tree" (
  `note_tree_id`	TEXT NOT NULL,
  `note_id`	TEXT NOT NULL,
  `parent_note_id`	TEXT NOT NULL,
  `note_position`	INTEGER NOT NULL,
  `prefix`	TEXT,
  `is_expanded`	BOOLEAN,
  `is_deleted`	INTEGER NOT NULL DEFAULT 0,
  `date_modified`	TEXT NOT NULL,
  PRIMARY KEY(`note_tree_id`)
);
CREATE TABLE IF NOT EXISTS "notes_history" (
  `note_history_id`	TEXT NOT NULL PRIMARY KEY,
  `note_id`	TEXT NOT NULL,
  `note_title`	TEXT,
  `note_text`	TEXT,
  `is_protected`	INT NOT NULL DEFAULT 0,
  `date_modified_from` TEXT NOT NULL,
  `date_modified_to` TEXT NOT NULL
);
CREATE TABLE `recent_notes` (
  `note_tree_id` TEXT NOT NULL PRIMARY KEY,
  `note_path` TEXT NOT NULL,
  `date_accessed` TEXT NOT NULL,
  is_deleted INT
);
CREATE UNIQUE INDEX `IDX_sync_entity_name_id` ON `sync` (
  `entity_name`,
  `entity_id`
);
CREATE INDEX `IDX_sync_sync_date` ON `sync` (
  `sync_date`
);
CREATE INDEX `IDX_notes_is_deleted` ON `notes` (
    `is_deleted`
);
CREATE INDEX `IDX_notes_tree_note_id_parent_note_id` ON `notes_tree` (
  `note_id`,
  `parent_note_id`
);
CREATE INDEX `IDX_notes_tree_note_id` ON `notes_tree` (
  `note_id`
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
CREATE TABLE images
(
  image_id TEXT PRIMARY KEY NOT NULL,
  format TEXT NOT NULL,
  checksum TEXT NOT NULL,
  name TEXT NOT NULL,
  data BLOB,
  is_deleted INT NOT NULL DEFAULT 0,
  date_modified TEXT NOT NULL,
  date_created TEXT NOT NULL
);

CREATE TABLE notes_image
(
  note_image_id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  is_deleted INT NOT NULL DEFAULT 0,
  date_modified TEXT NOT NULL,
  date_created TEXT NOT NULL
);

CREATE INDEX notes_image_note_id_index ON notes_image (note_id);
CREATE INDEX notes_image_image_id_index ON notes_image (image_id);
CREATE INDEX notes_image_note_id_image_id_index ON notes_image (note_id, image_id);

CREATE TABLE attributes
(
  attribute_id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT,
  date_created TEXT NOT NULL,
  date_modified TEXT NOT NULL
);

CREATE INDEX attributes_note_id_index ON attributes (note_id);
CREATE UNIQUE INDEX attributes_note_id_name_index ON attributes (note_id, name);