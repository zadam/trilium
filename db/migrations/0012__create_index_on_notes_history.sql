CREATE UNIQUE INDEX `IDX_notes_history_note_from_to` ON `notes_history` (
	`note_id`,
	`date_modified_from`,
	`date_modified_to`
);