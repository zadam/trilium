CREATE TABLE event_logc027
(
  id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  noteId TEXT,
  comment TEXT,
  dateAdded TEXT NOT NULL
);
INSERT INTO event_logc027(id, noteId, comment, dateAdded) SELECT id, noteId, comment, dateAdded FROM event_log;
DROP TABLE event_log;
ALTER TABLE event_logc027 RENAME TO event_log;

CREATE TABLE IF NOT EXISTS "notes_mig" (
  `noteId`	TEXT NOT NULL,
  `title`	TEXT NOT NULL DEFAULT "unnamed",
  `content`	TEXT NOT NULL DEFAULT "",
  `isProtected`	INT NOT NULL DEFAULT 0,
  `isDeleted`	INT NOT NULL DEFAULT 0,
  `dateCreated`	TEXT NOT NULL,
  `dateModified`	TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  mime TEXT NOT NULL DEFAULT 'text/html',
  PRIMARY KEY(`noteId`)
);

INSERT INTO notes_mig (noteId, title, content, isProtected, isDeleted, dateCreated, dateModified, type, mime)
    SELECT noteId, title, content, isProtected, isDeleted, dateCreated, dateModified, type, mime FROM notes;

DROP TABLE notes;

ALTER TABLE notes_mig RENAME TO notes;

CREATE INDEX `IDX_notes_isDeleted` ON `notes` (
  `isDeleted`
);