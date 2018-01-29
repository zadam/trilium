CREATE INDEX `IDX_notes_history_note_id` ON `notes_history` (
	`note_id`
);

CREATE INDEX `IDX_images_note_id` ON `images` (
	`note_id`
);

CREATE INDEX `IDX_links_note_id` ON `links` (
	`note_id`
);

CREATE INDEX `IDX_audit_log_note_id` ON `audit_log` (
	`note_id`
);

CREATE INDEX `IDX_audit_log_date_modified` ON `audit_log` (
	`date_modified`
);

CREATE TABLE `notes_mig` (
	`note_id`	TEXT NOT NULL,
	`note_title`	TEXT,
	`note_text`	TEXT,
	`note_clone_id`	TEXT,
	`date_created`	INT,
	`date_modified`	INT,
	`encryption`	INT,
	`is_deleted`	INTEGER NOT NULL DEFAULT 0,
	PRIMARY KEY(`note_id`)
);

INSERT INTO notes_mig (note_id, note_title, note_text, note_clone_id, date_created, date_modified, encryption)
    SELECT note_id, note_title, note_text, note_clone_id, date_created, date_modified, encryption FROM notes;

DROP TABLE notes;
ALTER TABLE notes_mig RENAME TO notes;

CREATE INDEX `IDX_notes_is_deleted` ON `notes` (
	`is_deleted`
);