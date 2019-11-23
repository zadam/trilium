CREATE TABLE IF NOT EXISTS "notes_mig" (
                                           `noteId`	TEXT NOT NULL,
                                           `title`	TEXT NOT NULL DEFAULT "note",
                                           `contentLength`	INT NOT NULL,
                                           `isProtected`	INT NOT NULL DEFAULT 0,
                                           `type` TEXT NOT NULL DEFAULT 'text',
                                           `mime` TEXT NOT NULL DEFAULT 'text/html',
                                           `hash` TEXT DEFAULT "" NOT NULL,
                                           `isDeleted`	INT NOT NULL DEFAULT 0,
                                           `isErased`	INT NOT NULL DEFAULT 0,
                                           `dateCreated`	TEXT NOT NULL,
                                           `dateModified`	TEXT NOT NULL,
                                           `utcDateCreated`	TEXT NOT NULL,
                                           `utcDateModified`	TEXT NOT NULL,
                                           PRIMARY KEY(`noteId`));

INSERT INTO notes_mig (noteId, title, contentLength, isProtected, type, mime, hash, isDeleted, isErased, dateCreated, dateModified, utcDateCreated, utcDateModified)
SELECT noteId, title, -1, isProtected, type, mime, hash, isDeleted, isErased, dateCreated, dateModified, utcDateCreated, utcDateModified FROM notes;

DROP TABLE notes;
ALTER TABLE notes_mig RENAME TO notes;

UPDATE notes SET contentLength = COALESCE((SELECT COALESCE(LENGTH(content), 0) FROM note_contents WHERE note_contents.noteId = notes.noteId), -1);

CREATE INDEX `IDX_notes_isDeleted` ON `notes` (`isDeleted`);
CREATE INDEX `IDX_notes_title` ON `notes` (`title`);
CREATE INDEX `IDX_notes_type` ON `notes` (`type`);
CREATE INDEX `IDX_notes_dateCreated` ON `notes` (`dateCreated`);
CREATE INDEX `IDX_notes_dateModified` ON `notes` (`dateModified`);
CREATE INDEX `IDX_notes_utcDateModified` ON `notes` (`utcDateModified`);
CREATE INDEX `IDX_notes_utcDateCreated` ON `notes` (`utcDateCreated`);

-- should be OK since sync protocol changes so all instances must upgrade
UPDATE attributes SET isDeleted = 1 WHERE name = 'fileSize';