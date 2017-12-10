DROP TABLE migrations;

-- Sync
CREATE TABLE `sync_mig` (
    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    `entity_name`	TEXT NOT NULL,
    `entity_id`	TEXT NOT NULL,
    `source_id` TEXT NOT NULL,
    `sync_date`	TEXT NOT NULL);

INSERT INTO sync_mig (id, entity_name, entity_id, source_id, sync_date)
               SELECT id, entity_name, entity_id, source_id, strftime('%Y-%m-%dT%H:%M:%S.000Z', sync_date, 'unixepoch') FROM sync;

DROP TABLE sync;
ALTER TABLE sync_mig RENAME TO sync;

CREATE UNIQUE INDEX `IDX_sync_entity_name_id` ON `sync` (
  `entity_name`,
  `entity_id`
);

CREATE INDEX `IDX_sync_sync_date` ON `sync` (
  `sync_date`
);

-- Options

UPDATE options SET opt_value = strftime('%Y-%m-%dT%H:%M:%S.000Z', opt_value, 'unixepoch') WHERE opt_name IN ('last_backup_date');
UPDATE options SET date_modified = strftime('%Y-%m-%dT%H:%M:%S.000Z', date_modified, 'unixepoch');

-- Event log

CREATE TABLE `event_log_mig` (
  `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  `note_id`	TEXT,
  `comment`	TEXT,
  `date_added`	TEXT NOT NULL
);

INSERT INTO event_log_mig (id, note_id, comment, date_added)
                    SELECT id, note_id, comment, strftime('%Y-%m-%dT%H:%M:%S.000Z', date_added, 'unixepoch') FROM event_log;

DROP TABLE event_log;
ALTER TABLE event_log_mig RENAME TO event_log;

CREATE INDEX `IDX_event_log_date_added` ON `event_log` (
  `date_added`
);

-- Notes

CREATE TABLE IF NOT EXISTS "notes_mig" (
  `note_id`	TEXT NOT NULL,
  `note_title`	TEXT,
  `note_text`	TEXT,
  `is_protected`	INT NOT NULL DEFAULT 0,
  `is_deleted`	INT NOT NULL DEFAULT 0,
  `date_created`	TEXT NOT NULL,
  `date_modified`	TEXT NOT NULL,
  PRIMARY KEY(`note_id`)
);

INSERT INTO notes_mig (note_id, note_title, note_text, is_protected, is_deleted, date_created, date_modified)
                SELECT note_id, note_title, note_text, is_protected, is_deleted,
                  strftime('%Y-%m-%dT%H:%M:%S.000Z', date_created, 'unixepoch'),
                  strftime('%Y-%m-%dT%H:%M:%S.000Z', date_modified, 'unixepoch')
                FROM notes;

DROP TABLE notes;
ALTER TABLE notes_mig RENAME TO notes;

CREATE INDEX `IDX_notes_is_deleted` ON `notes` (
  `is_deleted`
);

-- note history

CREATE TABLE IF NOT EXISTS "notes_history_mig" (
  `note_history_id`	TEXT NOT NULL PRIMARY KEY,
  `note_id`	TEXT NOT NULL,
  `note_title`	TEXT,
  `note_text`	TEXT,
  `is_protected`	INT NOT NULL DEFAULT 0,
  `date_modified_from` TEXT NOT NULL,
  `date_modified_to` TEXT NOT NULL
);

INSERT INTO notes_history_mig (note_history_id, note_id, note_title, note_text, is_protected, date_modified_from, date_modified_to)
  SELECT note_history_id, note_id, note_title, note_text, is_protected,
    strftime('%Y-%m-%dT%H:%M:%S.000Z', date_modified_from, 'unixepoch'),
    strftime('%Y-%m-%dT%H:%M:%S.000Z', date_modified_to, 'unixepoch')
  FROM notes_history;

DROP TABLE notes_history;
ALTER TABLE notes_history_mig RENAME TO notes_history;

CREATE INDEX `IDX_notes_history_note_id` ON `notes_history` (
  `note_id`
);
CREATE INDEX `IDX_notes_history_note_date_modified_from` ON `notes_history` (
  `date_modified_from`
);
CREATE INDEX `IDX_notes_history_note_date_modified_to` ON `notes_history` (
  `date_modified_to`
);

-- Source IDs

DROP TABLE source_ids;

CREATE TABLE `source_ids` (
  `source_id`	TEXT NOT NULL,
  `date_created`	TEXT NOT NULL,
  PRIMARY KEY(`source_id`)
);

-- Recent notes

DROP TABLE recent_notes;

CREATE TABLE `recent_notes` (
  `note_tree_id` TEXT NOT NULL PRIMARY KEY,
  `note_path` TEXT NOT NULL,
  `date_accessed` TEXT NOT NULL,
  is_deleted INT
);

-- Notes tree

CREATE TABLE IF NOT EXISTS "notes_tree_mig" (
  `note_tree_id`	TEXT NOT NULL,
  `note_id`	TEXT NOT NULL,
  `note_pid`	TEXT NOT NULL,
  `note_pos`	INTEGER NOT NULL,
  `prefix`	TEXT,
  `is_expanded`	BOOLEAN,
  `is_deleted`	INTEGER NOT NULL DEFAULT 0,
  `date_modified`	TEXT NOT NULL,
  PRIMARY KEY(`note_tree_id`)
);

INSERT INTO notes_tree_mig (note_tree_id, note_id, note_pid, note_pos, prefix, is_expanded, is_deleted, date_modified)
                     SELECT note_tree_id, note_id, note_pid, note_pos, prefix, is_expanded, is_deleted,
                            strftime('%Y-%m-%dT%H:%M:%S.000Z', date_modified, 'unixepoch')
                     FROM notes_tree;

DROP TABLE notes_tree;
ALTER TABLE notes_tree_mig RENAME TO notes_tree;

CREATE INDEX `IDX_notes_tree_note_tree_id` ON `notes_tree` (
  `note_tree_id`
);
CREATE INDEX `IDX_notes_tree_note_id_note_pid` ON `notes_tree` (
  `note_id`,
  `note_pid`
);
