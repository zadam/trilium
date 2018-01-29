CREATE TABLE "notes_tree_mig" (
    [note_tree_id] VARCHAR(30) PRIMARY KEY NOT NULL,
    [note_id] VARCHAR(30) NOT NULL,
    [note_pid] VARCHAR(30) NOT NULL,
    [note_pos] INTEGER NOT NULL,
    [is_expanded] BOOLEAN NULL ,
    date_modified INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

INSERT INTO notes_tree_mig (note_tree_id, note_id, note_pid, note_pos, is_expanded, date_modified, is_deleted)
    SELECT note_tree_id, note_id, note_pid, note_pos, is_expanded, date_modified, is_deleted FROM notes_tree;

DROP TABLE notes_tree;
ALTER TABLE notes_tree_mig RENAME TO notes_tree;

CREATE INDEX `IDX_notes_tree_note_tree_id` ON `notes_tree` (
	`note_tree_id`
);

CREATE INDEX `IDX_notes_tree_note_id_note_pid` ON `notes_tree` (
	`note_id`,
	`note_pid`
);