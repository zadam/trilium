DROP TABLE recent_notes;

CREATE TABLE `recent_notes` (
    `note_tree_id` TEXT NOT NULL PRIMARY KEY,
    `date_accessed` INTEGER NOT NULL ,
    is_deleted INT
);