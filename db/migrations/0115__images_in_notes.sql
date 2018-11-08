-- allow null for note content (for deleted notes)
CREATE TABLE IF NOT EXISTS "notes_mig" (
  `noteId`	TEXT NOT NULL,
  `title`	TEXT NOT NULL DEFAULT "note",
  `content`	TEXT NULL DEFAULT NULL,
  `isProtected`	INT NOT NULL DEFAULT 0,
  `type` TEXT NOT NULL DEFAULT 'text',
  `mime` TEXT NOT NULL DEFAULT 'text/html',
  `hash` TEXT DEFAULT "" NOT NULL,
  `isDeleted`	INT NOT NULL DEFAULT 0,
  `dateCreated`	TEXT NOT NULL,
  `dateModified`	TEXT NOT NULL,
  PRIMARY KEY(`noteId`)
);

INSERT INTO notes_mig (noteId, title, content, isProtected, isDeleted, dateCreated, dateModified, type, mime, hash)
SELECT noteId, title, content, isProtected, isDeleted, dateCreated, dateModified, type, mime, hash FROM notes;

DROP TABLE notes;

ALTER TABLE notes_mig RENAME TO notes;

CREATE TABLE "links" (
  `linkId`	TEXT NOT NULL,
  `noteId`	TEXT NOT NULL,
  `targetNoteId`	TEXT NOT NULL,
  `type` TEXT NOT NULL,
  `hash` TEXT DEFAULT "" NOT NULL,
  `isDeleted`	INTEGER NOT NULL DEFAULT 0,
  `dateCreated`	TEXT NOT NULL,
  `dateModified`	TEXT NOT NULL,
  PRIMARY KEY(`linkId`)
);

INSERT INTO links (linkId, noteId, targetNoteId, type, isDeleted, dateCreated, dateModified)
  SELECT 'L' || SUBSTR(noteImageId, 1), noteId, imageId, 'image', isDeleted, dateCreated, dateModified FROM note_images;

INSERT INTO branches (branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, dateModified, hash, dateCreated)
  SELECT 'B' || SUBSTR(noteImageId, 1), imageId, noteId, 100, '', 0, isDeleted, dateModified, hash, dateCreated FROM note_images;

DROP TABLE note_images;

INSERT INTO notes (noteId, title, content, isProtected, isDeleted, dateCreated, dateModified, type, mime, hash)
  SELECT imageId, name, data, 0, isDeleted, dateCreated, dateModified, 'image', 'image/' || format, hash FROM images;

DROP TABLE images;

UPDATE sync SET entityName = 'notes' WHERE entityName = 'images';

INSERT INTO sync (entityName, entityId, sourceId, syncDate)
SELECT 'links', 'L' || SUBSTR(entityId, 1), sourceId, syncDate FROM sync WHERE entityName = 'note_images';

INSERT INTO sync (entityName, entityId, sourceId, syncDate)
  SELECT 'branches', 'B' || SUBSTR(entityId, 1), sourceId, syncDate FROM sync WHERE entityName = 'note_images';

DELETE FROM sync WHERE entityName = 'note_images';
DELETE FROM sync WHERE entityName = 'images';