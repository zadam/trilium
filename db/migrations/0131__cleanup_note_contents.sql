CREATE TABLE IF NOT EXISTS "note_contents_mig" (
                                                   `noteId`	TEXT NOT NULL,
                                                   `content`	TEXT NULL DEFAULT NULL,
                                                   `hash` TEXT DEFAULT "" NOT NULL,
                                                   `utcDateModified` TEXT NOT NULL,
                                                   PRIMARY KEY(`noteId`)
);

INSERT INTO note_contents_mig (noteId, content, hash, utcDateModified)
SELECT noteId, content, hash, utcDateModified FROM note_contents;

DROP TABLE note_contents;
ALTER TABLE note_contents_mig RENAME TO note_contents;
