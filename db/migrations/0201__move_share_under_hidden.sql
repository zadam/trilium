DELETE FROM branches WHERE noteId = '_share' AND parentNoteId != 'root'; -- delete all other branches of _share if any
UPDATE branches SET parentNoteId = '_hidden' WHERE noteId = '_share';
