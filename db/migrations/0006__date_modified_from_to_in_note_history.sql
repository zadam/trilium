CREATE TABLE notes_history_mig AS SELECT id, note_id, note_title, note_text, date_modified AS date_modified_from, date_modified AS date_modified_to FROM notes_history;
DROP TABLE notes_history;
ALTER TABLE notes_history_mig RENAME TO notes_history;