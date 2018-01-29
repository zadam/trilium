ALTER TABLE notes_history ADD COLUMN note_history_id TEXT;

UPDATE notes_history SET note_history_id = id;

CREATE UNIQUE INDEX `IDX_note_history_note_history_id` ON `notes_history` (
	`note_history_id`
);