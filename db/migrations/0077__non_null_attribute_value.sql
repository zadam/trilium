UPDATE attributes SET value = '' WHERE value IS NULL;

CREATE TABLE IF NOT EXISTS "attributes_mig"
(
  attributeId TEXT PRIMARY KEY NOT NULL,
  noteId TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  position INT NOT NULL DEFAULT 0,
  dateCreated TEXT NOT NULL,
  dateModified TEXT NOT NULL,
  isDeleted INT NOT NULL
);

INSERT INTO attributes_mig (attributeId, noteId, name, value, position, dateCreated, dateModified, isDeleted)
    SELECT attributeId, noteId, name, value, position, dateCreated, dateModified, isDeleted FROM attributes;

DROP TABLE attributes;

ALTER TABLE attributes_mig RENAME TO attributes;

CREATE INDEX IDX_attributes_noteId ON attributes (noteId);
CREATE INDEX IDX_attributes_name_value ON attributes (name, value);