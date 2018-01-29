UPDATE
    notes_tree
SET
    note_pid = (SELECT parent.note_id FROM notes_tree parent WHERE notes_tree.note_pid = parent.note_tree_id)
WHERE
    note_pid != 'root'