ALTER TABLE notes_tree ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;

CREATE INDEX `IDX_notes_tree_is_deleted` ON `notes_tree` (
	`is_deleted`
);