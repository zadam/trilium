CREATE TABLE `audit_log_mig` (
	`id`	TEXT NOT NULL PRIMARY KEY,
	`date_modified`	INTEGER NOT NULL,
	`category`	TEXT NOT NULL,
	`browser_id`	TEXT,
	`note_id`	TEXT,
	`change_from`	TEXT,
	`change_to`	TEXT,
	`comment`	TEXT
);

INSERT INTO audit_log_mig (id, date_modified, category, browser_id, note_id, change_from, change_to)
    SELECT id, date_modified, category, browser_id, note_id, change_from, change_to FROM audit_log;

DROP TABLE audit_log;
ALTER TABLE audit_log_mig RENAME TO audit_log;