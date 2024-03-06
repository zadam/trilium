CREATE TABLE IF NOT EXISTS "revisions" (`revisionId`	TEXT NOT NULL PRIMARY KEY,
                                        `noteId`	TEXT NOT NULL,
                                        type TEXT DEFAULT '' NOT NULL,
                                        mime TEXT DEFAULT '' NOT NULL,
                                        `title`	TEXT NOT NULL,
                                        `isProtected`	INT NOT NULL DEFAULT 0,
                                        blobId TEXT DEFAULT NULL,
                                        `utcDateLastEdited` TEXT NOT NULL,
                                        `utcDateCreated` TEXT NOT NULL,
                                        `utcDateModified` TEXT NOT NULL,
                                        `dateLastEdited` TEXT NOT NULL,
                                        `dateCreated` TEXT NOT NULL);

INSERT INTO revisions (revisionId, noteId, type, mime, title, isProtected, utcDateLastEdited, utcDateCreated, utcDateModified, dateLastEdited, dateCreated, blobId)
SELECT noteRevisionId, noteId, type, mime, title, isProtected, utcDateLastEdited, utcDateCreated, utcDateModified, dateLastEdited, dateCreated, blobId FROM note_revisions;

DROP TABLE note_revisions;

CREATE INDEX `IDX_revisions_noteId` ON `revisions` (`noteId`);
CREATE INDEX `IDX_revisions_utcDateCreated` ON `revisions` (`utcDateCreated`);
CREATE INDEX `IDX_revisions_utcDateLastEdited` ON `revisions` (`utcDateLastEdited`);
CREATE INDEX `IDX_revisions_dateCreated` ON `revisions` (`dateCreated`);
CREATE INDEX `IDX_revisions_dateLastEdited` ON `revisions` (`dateLastEdited`);
CREATE INDEX IF NOT EXISTS IDX_revisions_blobId on revisions (blobId);

UPDATE entity_changes SET entityName = 'revisions' WHERE entityName = 'note_revisions';
