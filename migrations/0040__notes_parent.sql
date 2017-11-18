CREATE TABLE [notes_parent] (
    [parent_id] VARCHAR(30) NOT NULL,
    [child_id] VARCHAR(30) NOT NULL,
    date_created INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (parent_id, child_id)
);

INSERT INTO notes_parent (parent_id, child_id, date_created)
    SELECT note_pid, note_tree_id, date_modified FROM notes_tree;

CREATE TABLE [notes_tree_mig] (
    [note_tree_id] VARCHAR(30) PRIMARY KEY NOT NULL,
    [note_id] VARCHAR(30) UNIQUE NOT NULL,
    [note_pos] INTEGER NOT NULL,
    [is_expanded] BOOLEAN NULL ,
    date_modified INTEGER NOT NULL DEFAULT 0,
    is_deleted INTEGER NOT NULL DEFAULT 0
);

INSERT INTO notes_tree_mig (note_tree_id, note_id, note_pos, is_expanded, date_modified, is_deleted)
    SELECT note_tree_id, note_id, note_pos, is_expanded, date_modified, is_deleted FROM notes_tree;

DROP TABLE notes_tree;
ALTER TABLE notes_tree_mig RENAME TO notes_tree;

CREATE INDEX `IDX_notes_tree_note_id` ON `notes_tree` (
	`note_id`
);