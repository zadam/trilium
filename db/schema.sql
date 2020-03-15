CREATE TABLE IF NOT EXISTS "source_ids" (
                                          `sourceId`	TEXT NOT NULL,
                                          `utcDateCreated`	TEXT NOT NULL,
                                          PRIMARY KEY(`sourceId`)
);
CREATE TABLE IF NOT EXISTS "api_tokens"
(
  apiTokenId TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL,
  utcDateCreated TEXT NOT NULL,
  isDeleted INT NOT NULL DEFAULT 0,
  hash TEXT DEFAULT "" NOT NULL);
CREATE TABLE IF NOT EXISTS "options"
(
  name TEXT not null PRIMARY KEY,
  value TEXT,
  isSynced INTEGER default 0 not null,
  hash TEXT default "" not null,
  utcDateCreated TEXT not null,
  utcDateModified TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "note_contents" (
                                                   `noteId`	TEXT NOT NULL,
                                                   `content`	TEXT NULL DEFAULT NULL,
                                                   `hash` TEXT DEFAULT "" NOT NULL,
                                                   `utcDateModified` TEXT NOT NULL,
                                                   PRIMARY KEY(`noteId`)
);
CREATE TABLE recent_notes
(
    noteId TEXT not null primary key,
    notePath TEXT not null,
    hash TEXT default "" not null,
    utcDateCreated TEXT not null,
    isDeleted INT
);
CREATE TABLE IF NOT EXISTS "note_revision_contents" (`noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
                                                 `content`	TEXT,
                                                 hash TEXT DEFAULT '' NOT NULL,
                                                 `utcDateModified` TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS "note_revisions" (`noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
                                                 `noteId`	TEXT NOT NULL,
                                                 `title`	TEXT,
                                                 `contentLength`	INT NOT NULL,
                                                 `isErased`	INT NOT NULL DEFAULT 0,
                                                 `isProtected`	INT NOT NULL DEFAULT 0,
                                                 `utcDateLastEdited` TEXT NOT NULL,
                                                 `utcDateCreated` TEXT NOT NULL,
                                                 `utcDateModified` TEXT NOT NULL,
                                                 `dateLastEdited` TEXT NOT NULL,
                                                 `dateCreated` TEXT NOT NULL,
                                                 type TEXT DEFAULT '' NOT NULL,
                                                 mime TEXT DEFAULT '' NOT NULL,
                                                 hash TEXT DEFAULT '' NOT NULL);
CREATE INDEX `IDX_note_revisions_noteId` ON `note_revisions` (`noteId`);
CREATE INDEX `IDX_note_revisions_utcDateCreated` ON `note_revisions` (`utcDateCreated`);
CREATE INDEX `IDX_note_revisions_utcDateLastEdited` ON `note_revisions` (`utcDateLastEdited`);
CREATE INDEX `IDX_note_revisions_dateCreated` ON `note_revisions` (`dateCreated`);
CREATE INDEX `IDX_note_revisions_dateLastEdited` ON `note_revisions` (`dateLastEdited`);
CREATE INDEX IDX_source_ids_utcDateCreated
    on source_ids (utcDateCreated);
CREATE TABLE IF NOT EXISTS "notes" (
                                           `noteId`	TEXT NOT NULL,
                                           `title`	TEXT NOT NULL DEFAULT "note",
                                           `contentLength`	INT NOT NULL,
                                           `isProtected`	INT NOT NULL DEFAULT 0,
                                           `type` TEXT NOT NULL DEFAULT 'text',
                                           `mime` TEXT NOT NULL DEFAULT 'text/html',
                                           `hash` TEXT DEFAULT "" NOT NULL,
                                           `isDeleted`	INT NOT NULL DEFAULT 0,
                                           `deleteId`   TEXT DEFAULT NULL,
                                           `isErased`	INT NOT NULL DEFAULT 0,
                                           `dateCreated`	TEXT NOT NULL,
                                           `dateModified`	TEXT NOT NULL,
                                           `utcDateCreated`	TEXT NOT NULL,
                                           `utcDateModified`	TEXT NOT NULL,
                                           PRIMARY KEY(`noteId`));
CREATE INDEX `IDX_notes_isDeleted` ON `notes` (`isDeleted`);
CREATE INDEX `IDX_notes_title` ON `notes` (`title`);
CREATE INDEX `IDX_notes_type` ON `notes` (`type`);
CREATE INDEX `IDX_notes_dateCreated` ON `notes` (`dateCreated`);
CREATE INDEX `IDX_notes_dateModified` ON `notes` (`dateModified`);
CREATE INDEX `IDX_notes_utcDateModified` ON `notes` (`utcDateModified`);
CREATE INDEX `IDX_notes_utcDateCreated` ON `notes` (`utcDateCreated`);
CREATE TABLE IF NOT EXISTS "branches" (
                                          `branchId`	TEXT NOT NULL,
                                          `noteId`	TEXT NOT NULL,
                                          `parentNoteId`	TEXT NOT NULL,
                                          `notePosition`	INTEGER NOT NULL,
                                          `prefix`	TEXT,
                                          `isExpanded`	INTEGER NOT NULL DEFAULT 0,
                                          `isDeleted`	INTEGER NOT NULL DEFAULT 0,
                                          `deleteId`    TEXT DEFAULT NULL,
                                          `utcDateModified`	TEXT NOT NULL,
                                          utcDateCreated TEXT NOT NULL,
                                          hash TEXT DEFAULT "" NOT NULL,
                                          PRIMARY KEY(`branchId`));
CREATE INDEX `IDX_branches_noteId_parentNoteId` ON `branches` (`noteId`,`parentNoteId`);
CREATE INDEX IDX_branches_parentNoteId ON branches (parentNoteId);
CREATE TABLE IF NOT EXISTS "attributes"
(
    attributeId      TEXT not null primary key,
    noteId       TEXT not null,
    type         TEXT not null,
    name         TEXT not null,
    value        TEXT default '' not null,
    position     INT  default 0 not null,
    utcDateCreated  TEXT not null,
    utcDateModified TEXT not null,
    isDeleted    INT  not null,
    `deleteId`    TEXT DEFAULT NULL,
    hash         TEXT default "" not null,
    isInheritable int DEFAULT 0 NULL);
CREATE INDEX IDX_attributes_name_value
    on attributes (name, value);
CREATE INDEX IDX_attributes_noteId_index
    on attributes (noteId);
CREATE INDEX IDX_attributes_value_index
    on attributes (value);
CREATE TABLE IF NOT EXISTS "sync" (
    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    `entityName`	TEXT NOT NULL,
    `entityId`	TEXT NOT NULL,
    `sourceId` TEXT NOT NULL,
    `isSynced` INTEGER default 0 not null,
    `utcSyncDate`	TEXT NOT NULL);
CREATE UNIQUE INDEX `IDX_sync_entityName_entityId` ON `sync` (
                                                              `entityName`,
                                                              `entityId`
    );
CREATE INDEX `IDX_sync_utcSyncDate` ON `sync` (
                                               `utcSyncDate`
    );
