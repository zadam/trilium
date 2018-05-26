ALTER TABLE branches ADD dateCreated TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';

CREATE TABLE `event_log_mig` (
  `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  `noteId`	TEXT,
  `comment`	TEXT,
  `dateCreated`	TEXT NOT NULL
);

INSERT INTO event_log_mig (id, noteId, comment, dateCreated)
SELECT id, noteId, comment, dateAdded FROM event_log;

DROP TABLE event_log;
ALTER TABLE event_log_mig RENAME TO event_log;

ALTER TABLE options ADD dateCreated TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z';

CREATE TABLE `recent_notes_mig` (
  `branchId` TEXT NOT NULL PRIMARY KEY,
  `notePath` TEXT NOT NULL,
  hash TEXT DEFAULT "" NOT NULL,
  `dateCreated` TEXT NOT NULL,
  isDeleted INT
);

INSERT INTO recent_notes_mig (branchId, notePath, hash, dateCreated, isDeleted)
SELECT branchId, notePath, hash, dateAccessed, isDeleted FROM recent_notes;

DROP TABLE recent_notes;
ALTER TABLE recent_notes_mig RENAME TO recent_notes;