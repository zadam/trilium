CREATE TABLE "options_mig" (
    `name`	TEXT NOT NULL PRIMARY KEY,
    `value`	TEXT,
    `dateModified` INT,
    isSynced INTEGER NOT NULL DEFAULT 0);

INSERT INTO options_mig (name, value, dateModified, isSynced)
    SELECT opt_name, opt_value, date_modified, is_synced FROM options;

DROP TABLE options;
ALTER TABLE options_mig RENAME TO options;

CREATE TABLE "sync_mig" (
  `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  `entityName`	TEXT NOT NULL,
  `entityId`	TEXT NOT NULL,
  `sourceId` TEXT NOT NULL,
  `syncDate`	TEXT NOT NULL);

INSERT INTO sync_mig (id, entityName, entityId, sourceId, syncDate)
    SELECT id, entity_name, entity_id, source_id, sync_date FROM sync;

DROP TABLE sync;
ALTER TABLE sync_mig RENAME TO sync;

CREATE UNIQUE INDEX `IDX_sync_entityName_entityId` ON `sync` (
  `entityName`,
  `entityId`
);

CREATE INDEX `IDX_sync_syncDate` ON `sync` (
  `syncDate`
);

CREATE TABLE `source_ids_mig` (
  `sourceId`	TEXT NOT NULL,
  `dateCreated`	TEXT NOT NULL,
  PRIMARY KEY(`sourceId`)
);

INSERT INTO source_ids_mig (sourceId, dateCreated)
    SELECT source_id, date_created FROM source_ids;

DROP TABLE source_ids;
ALTER TABLE source_ids_mig RENAME TO source_ids;

CREATE TABLE "notes_mig" (
  `noteId`	TEXT NOT NULL,
  `title`	TEXT,
  `content`	TEXT,
  `isProtected`	INT NOT NULL DEFAULT 0,
  `isDeleted`	INT NOT NULL DEFAULT 0,
  `dateCreated`	TEXT NOT NULL,
  `dateModified`	TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  mime TEXT NOT NULL DEFAULT 'text/html',
  PRIMARY KEY(`noteId`)
);

INSERT INTO notes_mig (noteId, title, content, isProtected, isDeleted, dateCreated, dateModified, type, mime)
    SELECT note_id, note_title, note_text, is_protected, is_deleted, date_created, date_modified, type, mime FROM notes;

DROP TABLE notes;
ALTER TABLE notes_mig RENAME TO notes;

CREATE INDEX `IDX_notes_isDeleted` ON `notes` (
  `isDeleted`
);

CREATE TABLE `event_log_mig` (
  `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  `noteId`	TEXT,
  `comment`	TEXT,
  `dateAdded`	TEXT NOT NULL,
  FOREIGN KEY(noteId) REFERENCES notes(noteId)
);

INSERT INTO event_log_mig (id, noteId, comment, dateAdded)
    SELECT id, note_id, comment, date_added FROM event_log;

DROP TABLE event_log;
ALTER TABLE event_log_mig RENAME TO event_log;

CREATE TABLE "note_tree" (
  `noteTreeId`	TEXT NOT NULL,
  `noteId`	TEXT NOT NULL,
  `parentNoteId`	TEXT NOT NULL,
  `notePosition`	INTEGER NOT NULL,
  `prefix`	TEXT,
  `isExpanded`	BOOLEAN,
  `isDeleted`	INTEGER NOT NULL DEFAULT 0,
  `dateModified`	TEXT NOT NULL,
  PRIMARY KEY(`noteTreeId`)
);

INSERT INTO note_tree (noteTreeId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, dateModified)
    SELECT note_tree_id, note_id, parent_note_id, note_position, prefix, is_expanded, is_deleted, date_modified FROM notes_tree;

DROP TABLE notes_tree;

CREATE INDEX `IDX_note_tree_noteId` ON `note_tree` (
  `noteId`
);

CREATE INDEX `IDX_note_tree_noteId_parentNoteId` ON `note_tree` (
  `noteId`,
  `parentNoteId`
);

CREATE TABLE "note_revisions" (
  `noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
  `noteId`	TEXT NOT NULL,
  `title`	TEXT,
  `content`	TEXT,
  `isProtected`	INT NOT NULL DEFAULT 0,
  `dateModifiedFrom` TEXT NOT NULL,
  `dateModifiedTo` TEXT NOT NULL
);

INSERT INTO note_revisions (noteRevisionId, noteId, title, content, isProtected, dateModifiedFrom, dateModifiedTo)
    SELECT note_history_id, note_id, note_title, note_text, is_protected, date_modified_from, date_modified_to FROM notes_history;

DROP TABLE notes_history;

CREATE INDEX `IDX_note_revisions_noteId` ON `note_revisions` (
  `noteId`
);

CREATE INDEX `IDX_note_revisions_dateModifiedFrom` ON `note_revisions` (
  `dateModifiedFrom`
);

CREATE INDEX `IDX_note_revisions_dateModifiedTo` ON `note_revisions` (
  `dateModifiedTo`
);

CREATE TABLE `recent_notes_mig` (
  `noteTreeId` TEXT NOT NULL PRIMARY KEY,
  `notePath` TEXT NOT NULL,
  `dateAccessed` TEXT NOT NULL,
  isDeleted INT
);

INSERT INTO recent_notes_mig (noteTreeId, notePath, dateAccessed, isDeleted)
    SELECT note_tree_id, note_path, date_accessed, is_deleted FROM recent_notes;

DROP TABLE recent_notes;
ALTER TABLE recent_notes_mig RENAME TO recent_notes;

CREATE TABLE images_mig
(
  imageId TEXT PRIMARY KEY NOT NULL,
  format TEXT NOT NULL,
  checksum TEXT NOT NULL,
  name TEXT NOT NULL,
  data BLOB,
  isDeleted INT NOT NULL DEFAULT 0,
  dateModified TEXT NOT NULL,
  dateCreated TEXT NOT NULL
);

INSERT INTO images_mig (imageId, format, checksum, name, data, isDeleted, dateModified, dateCreated)
    SELECT image_id, format, checksum, name, data, is_deleted, date_modified, date_created FROM images;

DROP TABLE images;
ALTER TABLE images_mig RENAME TO images;

CREATE TABLE note_images
(
  noteImageId TEXT PRIMARY KEY NOT NULL,
  noteId TEXT NOT NULL,
  imageId TEXT NOT NULL,
  isDeleted INT NOT NULL DEFAULT 0,
  dateModified TEXT NOT NULL,
  dateCreated TEXT NOT NULL
);

INSERT INTO note_images (noteImageId, noteId, imageId, isDeleted, dateModified, dateCreated)
    SELECT note_image_id, note_id, image_id, is_deleted, date_modified, date_created FROM notes_image;

DROP TABLE notes_image;

CREATE INDEX IDX_note_images_noteId ON note_images (noteId);

CREATE INDEX IDX_note_images_imageId ON note_images (imageId);

CREATE INDEX IDX_note_images_noteId_imageId ON note_images (noteId, imageId);

CREATE TABLE attributes_mig
(
  attributeId TEXT PRIMARY KEY NOT NULL,
  noteId TEXT NOT NULL,
  name TEXT NOT NULL,
  value TEXT,
  dateCreated TEXT NOT NULL,
  dateModified TEXT NOT NULL
);

INSERT INTO attributes_mig (attributeId, noteId, name, value, dateCreated, dateModified)
    SELECT attribute_id, note_id, name, value, date_created, date_modified FROM attributes;

DROP TABLE attributes;
ALTER TABLE attributes_mig RENAME TO attributes;

CREATE INDEX IDX_attributes_noteId ON attributes (noteId);

CREATE UNIQUE INDEX IDX_attributes_noteId_name ON attributes (noteId, name);
