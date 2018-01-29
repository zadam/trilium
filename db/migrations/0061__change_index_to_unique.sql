DROP INDEX IDX_notes_tree_note_id_parent_note_id;

CREATE UNIQUE INDEX `IDX_notes_tree_note_id_parent_note_id` ON `notes_tree` (
  `note_id`,
  `parent_note_id`
);