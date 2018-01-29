CREATE TABLE notes_mig AS SELECT note_id, note_title, note_text, note_clone_id, date_created, date_modified, encryption FROM notes;
DROP TABLE notes;
ALTER TABLE notes_mig RENAME TO notes;