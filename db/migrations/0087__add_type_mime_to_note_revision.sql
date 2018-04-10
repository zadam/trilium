ALTER TABLE note_revisions ADD type TEXT DEFAULT '' NOT NULL;
ALTER TABLE note_revisions ADD mime TEXT DEFAULT '' NOT NULL;

UPDATE note_revisions SET type = (SELECT type FROM notes WHERE notes.noteId = note_revisions.noteId);
UPDATE note_revisions SET mime = (SELECT mime FROM notes WHERE notes.noteId = note_revisions.noteId);