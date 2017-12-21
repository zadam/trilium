INSERT INTO notes (note_id, note_title, note_text, date_created, date_modified)
    VALUES ('root', 'root', 'root', strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'), strftime('%Y-%m-%dT%H:%M:%S.000Z', 'now'));

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
    SELECT note_id, note_title, note_text, is_protected, is_deleted, date_created, date_modified FROM notes;

DROP TABLE notes;
ALTER TABLE notes_mig RENAME TO notes;

CREATE INDEX `IDX_notes_is_deleted` ON `notes` (
    `is_deleted`
);

CREATE TABLE IF NOT EXISTS "notes_tree_mig" (
    `note_tree_id`	TEXT NOT NULL,
    `note_id`	TEXT NOT NULL,
    `parent_note_id`	TEXT NOT NULL,
    `note_position`	INTEGER NOT NULL,
    `prefix`	TEXT,
    `is_expanded`	BOOLEAN,
    `is_deleted`	INTEGER NOT NULL DEFAULT 0,
    `date_modified`	TEXT NOT NULL,
    FOREIGN KEY(note_id) REFERENCES notes(note_id),
    FOREIGN KEY(parent_note_id) REFERENCES notes(note_id),
    PRIMARY KEY(`note_tree_id`)
);

INSERT INTO notes_tree_mig (note_tree_id, note_id, parent_note_id, note_position, prefix, is_expanded, is_deleted, date_modified)
    SELECT note_tree_id, note_id, note_pid, note_pos, prefix, is_expanded, is_deleted, date_modified FROM notes_tree;

DROP TABLE notes_tree;
ALTER TABLE notes_tree_mig RENAME TO notes_tree;

CREATE INDEX `IDX_notes_tree_note_tree_id` ON `notes_tree` (
    `note_tree_id`
);
CREATE INDEX `IDX_notes_tree_note_id_parent_note_id` ON `notes_tree` (
    `note_id`,
    `parent_note_id`
);
CREATE INDEX `IDX_notes_tree_note_id` ON `notes_tree` (
    `note_id`
);

CREATE TABLE IF NOT EXISTS "notes_history_mig" (
    `note_history_id`	TEXT NOT NULL PRIMARY KEY,
    `note_id`	TEXT NOT NULL,
    `note_title`	TEXT,
    `note_text`	TEXT,
    `is_protected`	INT NOT NULL DEFAULT 0,
    `date_modified_from` TEXT NOT NULL,
    `date_modified_to` TEXT NOT NULL,
    FOREIGN KEY(note_id) REFERENCES notes(note_id)
);

INSERT INTO notes_history_mig (note_history_id, note_id, note_title, note_text, is_protected, date_modified_from, date_modified_to)
    SELECT note_history_id, note_id, note_title, note_text, is_protected, date_modified_from, date_modified_to FROM notes_history;

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

DROP TABLE recent_notes;

CREATE TABLE `recent_notes` (
    `note_tree_id` TEXT NOT NULL PRIMARY KEY,
    `note_path` TEXT NOT NULL,
    `date_accessed` TEXT NOT NULL,
    is_deleted INT,
    FOREIGN KEY(note_tree_id) REFERENCES notes_tree(note_tree_id)
);

DROP TABLE event_log;

CREATE TABLE `event_log` (
    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    `note_id`	TEXT,
    `comment`	TEXT,
    `date_added`	TEXT NOT NULL,
    FOREIGN KEY(note_id) REFERENCES notes(note_id)
);