DROP TABLE images;

CREATE TABLE images
(
  image_id TEXT PRIMARY KEY NOT NULL,
  format TEXT NOT NULL,
  checksum TEXT NOT NULL,
  name TEXT NOT NULL,
  data BLOB,
  is_deleted INT NOT NULL DEFAULT 0,
  date_modified TEXT NOT NULL,
  date_created TEXT NOT NULL
);

CREATE TABLE notes_image
(
  note_image_id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  is_deleted INT NOT NULL DEFAULT 0,
  date_modified TEXT NOT NULL,
  date_created TEXT NOT NULL
);

CREATE INDEX notes_image_note_id_index ON notes_image (note_id);
CREATE INDEX notes_image_image_id_index ON notes_image (image_id);
CREATE INDEX notes_image_note_id_image_id_index ON notes_image (note_id, image_id);