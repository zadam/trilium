DELETE FROM entity_changes WHERE entityName = 'recent_notes';

CREATE TABLE IF NOT EXISTS "mig_recent_notes"
(
    noteId TEXT not null primary key,
    notePath TEXT not null,
    utcDateCreated TEXT not null
);

INSERT INTO mig_recent_notes (noteId, notePath, utcDateCreated)
    SELECT noteId, notePath, utcDateCreated FROM recent_notes;

DROP TABLE recent_notes;
ALTER TABLE mig_recent_notes RENAME TO recent_notes;
