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
  is_deleted INT
);