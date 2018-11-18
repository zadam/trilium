-- first fix deleted status of existing images
UPDATE note_images SET isDeleted = 1 WHERE noteId IN (SELECT noteId FROM notes WHERE isDeleted = 1);

-- we don't need set data to null because table is going to be dropped anyway and we want image size into attribute
UPDATE images SET isDeleted = 1 WHERE imageId NOT IN (SELECT imageId FROM note_images WHERE isDeleted = 0);

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
  SELECT 'L' || SUBSTR(noteImageId, 2), noteId, imageId, 'image', isDeleted, dateCreated, dateModified FROM note_images;

INSERT INTO branches (branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, dateModified, hash, dateCreated)
  SELECT 'B' || SUBSTR(noteImageId, 2), imageId, noteId, 100, '', 0, isDeleted, dateModified, hash, dateCreated FROM note_images;

DROP TABLE note_images;

INSERT INTO notes (noteId, title, content, isProtected, isDeleted, dateCreated, dateModified, type, mime, hash)
  SELECT imageId, name, data, 0, isDeleted, dateCreated, dateModified, 'image', 'image/' || format, hash FROM images;

INSERT INTO attributes (attributeId, noteId, type, name, value, position, dateCreated, dateModified, isDeleted, hash, isInheritable)
  SELECT 'O' || SUBSTR(imageId, 2), imageId, 'label', 'originalFileName', name, 0, dateCreated, dateModified, isDeleted, '', 0 FROM images;

INSERT INTO attributes (attributeId, noteId, type, name, value, position, dateCreated, dateModified, isDeleted, hash, isInheritable)
SELECT 'F' || SUBSTR(imageId, 2), imageId, 'label', 'fileSize', LENGTH(data), 0, dateCreated, dateModified, isDeleted, '', 0 FROM images;

DROP TABLE images;

INSERT INTO sync (entityName, entityId, sourceId, syncDate)
SELECT 'attributes', 'O' || SUBSTR(entityId, 2), sourceId, syncDate FROM sync WHERE entityName = 'images';

INSERT INTO sync (entityName, entityId, sourceId, syncDate)
SELECT 'attributes', 'F' || SUBSTR(entityId, 2), sourceId, syncDate FROM sync WHERE entityName = 'images';

UPDATE sync SET entityName = 'notes' WHERE entityName = 'images';

INSERT INTO sync (entityName, entityId, sourceId, syncDate)
SELECT 'links', 'L' || SUBSTR(entityId, 2), sourceId, syncDate FROM sync WHERE entityName = 'note_images';

INSERT INTO sync (entityName, entityId, sourceId, syncDate)
  SELECT 'branches', 'B' || SUBSTR(entityId, 2), sourceId, syncDate FROM sync WHERE entityName = 'note_images';

DELETE FROM sync WHERE entityName = 'note_images';
DELETE FROM sync WHERE entityName = 'images';