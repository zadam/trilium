CREATE TABLE IF NOT EXISTS "notes_tree_mig" (
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

INSERT INTO notes_tree_mig (note_tree_id, note_id, parent_note_id, note_position, prefix, is_expanded, is_deleted, date_modified)
  SELECT note_tree_id, note_id, parent_note_id, note_position, prefix, is_expanded, is_deleted, date_modified FROM notes_tree;

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