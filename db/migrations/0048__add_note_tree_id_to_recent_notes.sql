DROP TABLE recent_notes;

CREATE TABLE `recent_notes` (
  'note_tree_id'TEXT NOT NULL PRIMARY KEY,
  `note_path` TEXT NOT NULL,
  `date_accessed` INTEGER NOT NULL ,
  is_deleted INT
);

DELETE FROM sync WHERE entity_name = 'recent_notes';