DROP TABLE images;

CREATE TABLE images
(
  image_id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL,
  format TEXT NOT NULL,
  checksum TEXT NOT NULL,
  name TEXT NOT NULL,
  data BLOB,
  is_deleted INT NOT NULL DEFAULT 0,
  date_modified TEXT NOT NULL,
  date_created TEXT NOT NULL
);

CREATE INDEX images_note_id_index ON images (note_id);