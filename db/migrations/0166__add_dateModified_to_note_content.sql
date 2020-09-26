CREATE TABLE IF NOT EXISTS "note_contents_mig" (
                                               `noteId`	TEXT NOT NULL,
                                               `content`	TEXT NULL DEFAULT NULL,
                                               `hash` TEXT DEFAULT "" NOT NULL,
                                               `dateModified` TEXT NOT NULL,
                                               `utcDateModified` TEXT NOT NULL,
                                               PRIMARY KEY(`noteId`)
);

INSERT INTO note_contents_mig (noteId, content, hash, dateModified, utcDateModified)
    SELECT noteId,
           content,
           hash,
           COALESCE((SELECT dateModified FROM notes WHERE noteId = note_contents.noteId), utcDateModified),
           utcDateModified
    FROM note_contents;

DROP TABLE note_contents;

ALTER TABLE note_contents_mig RENAME TO note_contents;
