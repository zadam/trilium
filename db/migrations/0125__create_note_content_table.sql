CREATE TABLE IF NOT EXISTS "note_contents" (
  `noteContentId`	TEXT NOT NULL,
  `noteId`	TEXT NOT NULL,
  `isProtected`	INT NOT NULL DEFAULT 0,
  `content`	TEXT NULL DEFAULT NULL,
  `hash` TEXT DEFAULT "" NOT NULL,
  `dateCreated`	TEXT NOT NULL,
  `dateModified` TEXT NOT NULL,
  PRIMARY KEY(`noteContentId`)
);

CREATE UNIQUE INDEX `IDX_note_contents_noteId` ON `note_contents` (`noteId`);

INSERT INTO note_contents (noteContentId, noteId, isProtected, content, dateCreated, dateModified)
  SELECT 'C' || SUBSTR(noteId, 2), noteId, isProtected, content, dateCreated, dateModified FROM notes;

CREATE TABLE IF NOT EXISTS "notes_mig" (
  `noteId`	TEXT NOT NULL,
  `title`	TEXT NOT NULL DEFAULT "note",
  `isProtected`	INT NOT NULL DEFAULT 0,
  `type` TEXT NOT NULL DEFAULT 'text',
  `mime` TEXT NOT NULL DEFAULT 'text/html',
  `hash` TEXT DEFAULT "" NOT NULL,
  `isDeleted`	INT NOT NULL DEFAULT 0,
  `dateCreated`	TEXT NOT NULL,
  `dateModified`	TEXT NOT NULL,
  PRIMARY KEY(`noteId`)
);

INSERT INTO notes_mig (noteId, title, isProtected, isDeleted, dateCreated, dateModified, type, mime, hash)
SELECT noteId, title, isProtected, isDeleted, dateCreated, dateModified, type, mime, hash FROM notes;

DROP TABLE notes;

ALTER TABLE notes_mig RENAME TO notes;
