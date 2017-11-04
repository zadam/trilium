CREATE TABLE `event_log` (
	`id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
	`note_id`	TEXT,
	`comment`	TEXT,
	`date_added`	INTEGER NOT NULL
);

CREATE INDEX `IDX_event_log_date_added` ON `event_log` (
	`date_added`
);