CREATE TABLE `notes_history_mig` (
	`id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT UNIQUE,
	`note_id`	INT,
	`note_title`	TEXT,
	`note_text`	TEXT,
	`date_modified_from`	INT,
	`date_modified_to`	INT,
	`encryption`	INTEGER DEFAULT 0
);

INSERT INTO notes_history (id, note_id, note_title, note_text, date_modified_from, date_modified_to, encryption)
    SELECT id, note_id, note_title, note_text, date_modified_from, date_modified_to, encryption FROM notes_history;

DROP TABLE notes_history;
ALTER TABLE notes_history_mig RENAME TO notes_history;