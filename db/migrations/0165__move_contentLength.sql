CREATE TABLE IF NOT EXISTS "notes_mig" (
                                       `noteId`	TEXT NOT NULL,
                                       `title`	TEXT NOT NULL DEFAULT "note",
                                       `isProtected`	INT NOT NULL DEFAULT 0,
                                       `type` TEXT NOT NULL DEFAULT 'text',
                                       `mime` TEXT NOT NULL DEFAULT 'text/html',
                                       `hash` TEXT DEFAULT "" NOT NULL,
                                       `isDeleted`	INT NOT NULL DEFAULT 0,
                                       `deleteId`   TEXT DEFAULT NULL,
                                       `isErased`	INT NOT NULL DEFAULT 0,
                                       `dateCreated`	TEXT NOT NULL,
                                       `dateModified`	TEXT NOT NULL,
                                       `utcDateCreated`	TEXT NOT NULL,
                                       `utcDateModified`	TEXT NOT NULL,
                                       PRIMARY KEY(`noteId`));

INSERT INTO notes_mig (noteId, title, isProtected, type, mime, hash, isDeleted, deleteId, isErased, dateCreated, dateModified, utcDateCreated, utcDateModified)
    SELECT noteId, title, isProtected, type, mime, hash, isDeleted, deleteId, isErased, dateCreated, dateModified, utcDateCreated, utcDateModified FROM notes;

DROP TABLE notes;
ALTER TABLE notes_mig RENAME TO notes;

CREATE INDEX `IDX_notes_isDeleted` ON `notes` (`isDeleted`);
CREATE INDEX `IDX_notes_title` ON `notes` (`title`);
CREATE INDEX `IDX_notes_type` ON `notes` (`type`);
CREATE INDEX `IDX_notes_dateCreated` ON `notes` (`dateCreated`);
CREATE INDEX `IDX_notes_dateModified` ON `notes` (`dateModified`);
CREATE INDEX `IDX_notes_utcDateModified` ON `notes` (`utcDateModified`);
CREATE INDEX `IDX_notes_utcDateCreated` ON `notes` (`utcDateCreated`);

CREATE TABLE IF NOT EXISTS "note_revisions_mig" (`noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
                                             `noteId`	TEXT NOT NULL,
                                             `title`	TEXT,
                                             `isErased`	INT NOT NULL DEFAULT 0,
                                             `isProtected`	INT NOT NULL DEFAULT 0,
                                             `utcDateLastEdited` TEXT NOT NULL,
                                             `utcDateCreated` TEXT NOT NULL,
                                             `utcDateModified` TEXT NOT NULL,
                                             `dateLastEdited` TEXT NOT NULL,
                                             `dateCreated` TEXT NOT NULL,
                                             type TEXT DEFAULT '' NOT NULL,
                                             mime TEXT DEFAULT '' NOT NULL,
                                             hash TEXT DEFAULT '' NOT NULL);

INSERT INTO note_revisions_mig (noteRevisionId, noteId, title, isErased, isProtected, utcDateLastEdited, utcDateCreated, utcDateModified, dateLastEdited, dateCreated, type, mime, hash)
SELECT noteRevisionId, noteId, title, isErased, isProtected, utcDateLastEdited, utcDateCreated, utcDateModified, dateLastEdited, dateCreated, type, mime, hash FROM note_revisions;

DROP TABLE note_revisions;
ALTER TABLE note_revisions_mig RENAME TO note_revisions;

CREATE INDEX `IDX_note_revisions_noteId` ON `note_revisions` (`noteId`);
CREATE INDEX `IDX_note_revisions_utcDateCreated` ON `note_revisions` (`utcDateCreated`);
CREATE INDEX `IDX_note_revisions_utcDateLastEdited` ON `note_revisions` (`utcDateLastEdited`);
CREATE INDEX `IDX_note_revisions_dateCreated` ON `note_revisions` (`dateCreated`);
CREATE INDEX `IDX_note_revisions_dateLastEdited` ON `note_revisions` (`dateLastEdited`);
