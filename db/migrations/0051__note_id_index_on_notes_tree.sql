DROP index IDX_notes_tree_note_tree_id;

CREATE INDEX `IDX_notes_tree_note_id` ON `notes_tree` (
  `note_id`
);