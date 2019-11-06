CREATE TABLE IF NOT EXISTS "note_revisions_mig" (`noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
                                                `noteId`	TEXT NOT NULL,
                                                `title`	TEXT,
                                                `contentLength`	INT NOT NULL,
                                                `isProtected`	INT NOT NULL DEFAULT 0,
                                                `utcDateLastEdited` TEXT NOT NULL,
                                                `utcDateCreated` TEXT NOT NULL,
                                                `utcDateModified` TEXT NOT NULL,
                                                `dateLastEdited` TEXT NOT NULL,
                                                `dateCreated` TEXT NOT NULL,
                                                type TEXT DEFAULT '' NOT NULL,
                                                mime TEXT DEFAULT '' NOT NULL,
                                                hash TEXT DEFAULT '' NOT NULL);

CREATE TABLE IF NOT EXISTS "note_revision_contents" (`noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
                                                 `content`	TEXT,
                                                 hash TEXT DEFAULT '' NOT NULL,
                                                 `utcDateModified` TEXT NOT NULL);

INSERT INTO note_revision_contents (noteRevisionId, content, hash, utcDateModified)
SELECT noteRevisionId, content, hash, utcDateModifiedTo FROM note_revisions;

INSERT INTO note_revisions_mig (noteRevisionId, noteId, title, contentLength, isProtected, utcDateLastEdited, utcDateCreated, utcDateModified, dateLastEdited, dateCreated, type, mime, hash)
SELECT noteRevisionId, noteId, title, COALESCE(LENGTH(content), 0), isProtected, utcDateModifiedFrom, utcDateModifiedTo, utcDateModifiedTo, dateModifiedFrom, dateModifiedTo, type, mime, hash FROM note_revisions;

DROP TABLE note_revisions;
ALTER TABLE note_revisions_mig RENAME TO note_revisions;

CREATE INDEX `IDX_note_revisions_noteId` ON `note_revisions` (`noteId`);
CREATE INDEX `IDX_note_revisions_utcDateCreated` ON `note_revisions` (`utcDateCreated`);
CREATE INDEX `IDX_note_revisions_utcDateLastEdited` ON `note_revisions` (`utcDateLastEdited`);
CREATE INDEX `IDX_note_revisions_dateCreated` ON `note_revisions` (`dateCreated`);
CREATE INDEX `IDX_note_revisions_dateLastEdited` ON `note_revisions` (`dateLastEdited`);

INSERT INTO sync (entityName, entityId, sourceId, utcSyncDate)
SELECT 'note_revision_contents', entityId, sourceId, utcSyncDate FROM sync WHERE entityName = 'note_revisions';