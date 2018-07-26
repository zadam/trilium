UPDATE notes SET content = '' WHERE isDeleted = 1;
UPDATE note_revisions SET content = '' WHERE (SELECT isDeleted FROM notes WHERE noteId = note_revisions.noteId) = 1;