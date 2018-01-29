UPDATE notes SET note_id = substr(note_id, 0, 22);
UPDATE notes_tree SET note_id = substr(note_id, 0, 22), note_pid = substr(note_pid, 0, 22);
UPDATE notes_history SET note_id = substr(note_id, 0, 22);
UPDATE audit_log SET note_id = substr(note_id, 0, 22);
UPDATE links SET note_id = substr(note_id, 0, 22);
UPDATE images SET note_id = substr(note_id, 0, 22);