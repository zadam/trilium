DROP INDEX IDX_notes_tree_note_id_parent_note_id;

CREATE INDEX `IDX_notes_tree_note_id_parent_note_id` ON `notes_tree` (
  `note_id`,
  `parent_note_id`
);

-- dropping this as it's just duplicate of primary key
DROP INDEX IDX_notes_tree_note_tree_id;