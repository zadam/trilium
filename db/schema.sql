CREATE TABLE IF NOT EXISTS "sync" (
  `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
  `entityName`	TEXT NOT NULL,
  `entityId`	TEXT NOT NULL,
  `sourceId` TEXT NOT NULL,
  `syncDate`	TEXT NOT NULL);
CREATE UNIQUE INDEX `IDX_sync_entityName_entityId` ON `sync` (
  `entityName`,
  `entityId`
);
CREATE INDEX `IDX_sync_syncDate` ON `sync` (
  `syncDate`
);
CREATE TABLE IF NOT EXISTS "source_ids" (
  `sourceId`	TEXT NOT NULL,
  `dateCreated`	TEXT NOT NULL,
  PRIMARY KEY(`sourceId`)
);
CREATE TABLE IF NOT EXISTS "note_revisions" (
  `noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
  `noteId`	TEXT NOT NULL,
  `title`	TEXT,
  `content`	TEXT,
  `isProtected`	INT NOT NULL DEFAULT 0,
  `dateModifiedFrom` TEXT NOT NULL,
  `dateModifiedTo` TEXT NOT NULL
, type TEXT DEFAULT '' NOT NULL, mime TEXT DEFAULT '' NOT NULL, hash TEXT DEFAULT "" NOT NULL);
CREATE INDEX `IDX_note_revisions_noteId` ON `note_revisions` (
  `noteId`
);
CREATE INDEX `IDX_note_revisions_dateModifiedFrom` ON `note_revisions` (
  `dateModifiedFrom`
);
CREATE INDEX `IDX_note_revisions_dateModifiedTo` ON `note_revisions` (
  `dateModifiedTo`
);
CREATE TABLE IF NOT EXISTS "images"
(
  imageId TEXT PRIMARY KEY NOT NULL,
  format TEXT NOT NULL,
  checksum TEXT NOT NULL,
  name TEXT NOT NULL,
  data BLOB,
  isDeleted INT NOT NULL DEFAULT 0,
  dateModified TEXT NOT NULL,
  dateCreated TEXT NOT NULL
, hash TEXT DEFAULT "" NOT NULL);
CREATE TABLE note_images
(
  noteImageId TEXT PRIMARY KEY NOT NULL,
  noteId TEXT NOT NULL,
  imageId TEXT NOT NULL,
  isDeleted INT NOT NULL DEFAULT 0,
  dateModified TEXT NOT NULL,
  dateCreated TEXT NOT NULL
, hash TEXT DEFAULT "" NOT NULL);
CREATE INDEX IDX_note_images_noteId ON note_images (noteId);
CREATE INDEX IDX_note_images_imageId ON note_images (imageId);
CREATE INDEX IDX_note_images_noteId_imageId ON note_images (noteId, imageId);
CREATE TABLE IF NOT EXISTS "api_tokens"
(
  apiTokenId TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL,
  dateCreated TEXT NOT NULL,
  isDeleted INT NOT NULL DEFAULT 0
, hash TEXT DEFAULT "" NOT NULL);
CREATE TABLE IF NOT EXISTS "branches" (
  `branchId`	TEXT NOT NULL,
  `noteId`	TEXT NOT NULL,
  `parentNoteId`	TEXT NOT NULL,
  `notePosition`	INTEGER NOT NULL,
  `prefix`	TEXT,
  `isExpanded`	BOOLEAN,
  `isDeleted`	INTEGER NOT NULL DEFAULT 0,
  `dateModified`	TEXT NOT NULL, hash TEXT DEFAULT "" NOT NULL, dateCreated TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z',
  PRIMARY KEY(`branchId`)
);
CREATE INDEX `IDX_branches_noteId` ON `branches` (
  `noteId`
);
CREATE INDEX `IDX_branches_noteId_parentNoteId` ON `branches` (
  `noteId`,
  `parentNoteId`
);
CREATE TABLE labels
(
  labelId  TEXT not null primary key,
  noteId       TEXT not null,
  name         TEXT not null,
  value        TEXT default '' not null,
  position     INT  default 0 not null,
  dateCreated  TEXT not null,
  dateModified TEXT not null,
  isDeleted    INT  not null
, hash TEXT DEFAULT "" NOT NULL);
CREATE INDEX IDX_labels_name_value
  on labels (name, value);
CREATE INDEX IDX_labels_noteId
  on labels (noteId);
CREATE TABLE IF NOT EXISTS "notes" (
  `noteId`	TEXT NOT NULL,
  `title`	TEXT NOT NULL DEFAULT "unnamed",
  `content`	TEXT NOT NULL DEFAULT "",
  `isProtected`	INT NOT NULL DEFAULT 0,
  `isDeleted`	INT NOT NULL DEFAULT 0,
  `dateCreated`	TEXT NOT NULL,
  `dateModified`	TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  mime TEXT NOT NULL DEFAULT 'text/html', hash TEXT DEFAULT "" NOT NULL,
  PRIMARY KEY(`noteId`)
);
CREATE INDEX IDX_branches_parentNoteId ON branches (parentNoteId);
CREATE INDEX IDX_notes_type
  on notes (type);
CREATE TABLE IF NOT EXISTS "recent_notes" (
  `branchId` TEXT NOT NULL PRIMARY KEY,
  `notePath` TEXT NOT NULL,
  hash TEXT DEFAULT "" NOT NULL,
  `dateCreated` TEXT NOT NULL,
  isDeleted INT
);
CREATE TABLE IF NOT EXISTS "event_log" (
  `eventId`	TEXT NOT NULL PRIMARY KEY,
  `noteId`	TEXT,
  `comment`	TEXT,
  `dateCreated`	TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "options"
(
  name TEXT not null PRIMARY KEY,
  value TEXT,
  dateModified INT,
  isSynced INTEGER default 0 not null,
  hash TEXT default "" not null,
  dateCreated TEXT default '1970-01-01T00:00:00.000Z' not null
);
