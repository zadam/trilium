CREATE VIRTUAL TABLE note_fulltext USING fts5(noteId UNINDEXED, title, titleHash UNINDEXED, content, contentHash UNINDEXED);
