CREATE TABLE `notes_history_mig` (
	`note_history_id`	TEXT NOT NULL PRIMARY KEY,
	`note_id`	TEXT NOT NULL,
	`note_title`	TEXT,
	`note_text`	TEXT,
	`encryption`	INT,
	`date_modified_from` INT,
	`date_modified_to` INT
);

INSERT INTO notes_history_mig (note_history_id, note_id, note_title, note_text, encryption, date_modified_from, date_modified_to)
    SELECT note_history_id, note_id, note_title, note_text, encryption, date_modified_from, date_modified_to FROM notes_history;

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