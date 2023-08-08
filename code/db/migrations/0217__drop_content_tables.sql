DROP TABLE note_contents;
DROP TABLE note_revision_contents;

DELETE FROM entity_changes WHERE entityName IN ('note_contents', 'note_revision_contents');
