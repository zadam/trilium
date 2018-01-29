CREATE TABLE attributes
(
  attribute_id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT,
  date_created TEXT NOT NULL,
  date_modified TEXT NOT NULL
);

CREATE INDEX attributes_note_id_index ON attributes (note_id);
CREATE UNIQUE INDEX attributes_note_id_name_index ON attributes (note_id, name);