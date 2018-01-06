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