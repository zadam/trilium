CREATE TABLE IF NOT EXISTS "sync" (
                                    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                    `entityName`	TEXT NOT NULL,
                                    `entityId`	TEXT NOT NULL,
                                    `sourceId` TEXT NOT NULL,
                                    `utcSyncDate`	TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS "source_ids" (
                                          `sourceId`	TEXT NOT NULL,
                                          `utcDateCreated`	TEXT NOT NULL,
                                          PRIMARY KEY(`sourceId`)
);
CREATE TABLE IF NOT EXISTS "note_revisions" (
                                              `noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
                                              `noteId`	TEXT NOT NULL,
                                              `title`	TEXT,
                                              `content`	TEXT,
                                              `isProtected`	INT NOT NULL DEFAULT 0,
                                              `utcDateModifiedFrom` TEXT NOT NULL,
                                              `utcDateModifiedTo` TEXT NOT NULL,
                                              `dateModifiedFrom` TEXT NOT NULL,
                                              `dateModifiedTo` TEXT NOT NULL,
                                              type TEXT DEFAULT '' NOT NULL,
                                              mime TEXT DEFAULT '' NOT NULL,
                                              hash TEXT DEFAULT "" NOT NULL);
CREATE TABLE IF NOT EXISTS "api_tokens"
(
  apiTokenId TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL,
  utcDateCreated TEXT NOT NULL,
  isDeleted INT NOT NULL DEFAULT 0,
  hash TEXT DEFAULT "" NOT NULL);
CREATE TABLE IF NOT EXISTS "branches" (
                                        `branchId`	TEXT NOT NULL,
                                        `noteId`	TEXT NOT NULL,
                                        `parentNoteId`	TEXT NOT NULL,
                                        `notePosition`	INTEGER NOT NULL,
                                        `prefix`	TEXT,
                                        `isExpanded`	BOOLEAN,
                                        `isDeleted`	INTEGER NOT NULL DEFAULT 0,
                                        `utcDateModified`	TEXT NOT NULL,
                                        utcDateCreated TEXT NOT NULL,
                                        hash TEXT DEFAULT "" NOT NULL,
                                        PRIMARY KEY(`branchId`)
);
CREATE TABLE IF NOT EXISTS "event_log" (
                                         `eventId`	TEXT NOT NULL PRIMARY KEY,
                                         `noteId`	TEXT,
                                         `comment`	TEXT,
                                         `utcDateCreated`	TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS "options"
(
  name TEXT not null PRIMARY KEY,
  value TEXT,
  isSynced INTEGER default 0 not null,
  hash TEXT default "" not null,
  utcDateCreated TEXT not null,
  utcDateModified TEXT NOT NULL
);
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
  hash         TEXT default "" not null,
  isInheritable int DEFAULT 0 NULL);
CREATE TABLE IF NOT EXISTS "links" (
                                     `linkId`	TEXT NOT NULL,
                                     `noteId`	TEXT NOT NULL,
                                     `targetNoteId`	TEXT NOT NULL,
                                     `type` TEXT NOT NULL,
                                     `hash` TEXT DEFAULT "" NOT NULL,
                                     `isDeleted`	INTEGER NOT NULL DEFAULT 0,
                                     `utcDateCreated`	TEXT NOT NULL,
                                     `utcDateModified`	TEXT NOT NULL,
                                     PRIMARY KEY(`linkId`)
);
CREATE TABLE IF NOT EXISTS "notes" (
                                     `noteId`	TEXT NOT NULL,
                                     `title`	TEXT NOT NULL DEFAULT "note",
                                     `isProtected`	INT NOT NULL DEFAULT 0,
                                     `type` TEXT NOT NULL DEFAULT 'text',
                                     `mime` TEXT NOT NULL DEFAULT 'text/html',
                                     `hash` TEXT DEFAULT "" NOT NULL,
                                     `isDeleted`	INT NOT NULL DEFAULT 0,
                                     `dateCreated`	TEXT NOT NULL,
                                     `dateModified`	TEXT NOT NULL,
                                     `utcDateCreated`	TEXT NOT NULL,
                                     `utcDateModified`	TEXT NOT NULL,
                                     PRIMARY KEY(`noteId`)
);
CREATE UNIQUE INDEX `IDX_sync_entityName_entityId` ON `sync` (
                                                              `entityName`,
                                                              `entityId`
  );
CREATE INDEX `IDX_sync_utcSyncDate` ON `sync` (
                                            `utcSyncDate`
  );
CREATE INDEX `IDX_note_revisions_noteId` ON `note_revisions` (
                                                              `noteId`
  );
CREATE INDEX `IDX_note_revisions_dateModifiedFrom` ON `note_revisions` (
                                                                        `utcDateModifiedFrom`
  );
CREATE INDEX `IDX_note_revisions_dateModifiedTo` ON `note_revisions` (
                                                                      `utcDateModifiedTo`
  );
CREATE INDEX `IDX_branches_noteId` ON `branches` (
                                                  `noteId`
  );
CREATE INDEX `IDX_branches_noteId_parentNoteId` ON `branches` (
                                                               `noteId`,
                                                               `parentNoteId`
  );
CREATE INDEX IDX_branches_parentNoteId ON branches (parentNoteId);
CREATE INDEX IDX_attributes_name_value
  on attributes (name, value);
CREATE INDEX IDX_links_noteId_index
  on links (noteId);
CREATE INDEX IDX_links_targetNoteId_index
  on links (targetNoteId);
CREATE INDEX IDX_attributes_name_index
  on attributes (name);
CREATE INDEX IDX_attributes_noteId_index
  on attributes (noteId);
CREATE INDEX IDX_attributes_value_index
  on attributes (value);
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
