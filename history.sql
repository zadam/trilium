CREATE TABLE `notes_history` (
	`id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	`note_id`	INTEGER NOT NULL,
	`note_text`	TEXT NOT NULL,
	`date_modified`	INTEGER NOT NULL
);