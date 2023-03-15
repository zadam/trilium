CREATE TABLE IF NOT EXISTS "blobs" (
                                               `blobId`	TEXT NOT NULL,
                                               `content`	TEXT NULL DEFAULT NULL,
                                               `dateModified` TEXT NOT NULL,
                                               `utcDateModified` TEXT NOT NULL,
                                               PRIMARY KEY(`blobId`)
);

ALTER TABLE notes ADD blobId TEXT DEFAULT NULL;
ALTER TABLE note_revisions ADD blobId TEXT DEFAULT NULL;
