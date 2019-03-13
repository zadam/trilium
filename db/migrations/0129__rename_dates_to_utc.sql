CREATE TABLE IF NOT EXISTS "sync_mig" (
                                    `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                    `entityName`	TEXT NOT NULL,
                                    `entityId`	TEXT NOT NULL,
                                    `sourceId` TEXT NOT NULL,
                                    `utcSyncDate`	TEXT NOT NULL);

INSERT INTO sync_mig (id, entityName, entityId, sourceId, utcSyncDate)
  SELECT id, entityName, entityId, sourceId, REPLACE(syncDate, 'T', ' ') FROM sync;

DROP TABLE sync;
ALTER TABLE sync_mig RENAME TO sync;


CREATE TABLE IF NOT EXISTS "source_ids_mig" (
                                          `sourceId`	TEXT NOT NULL,
                                          `utcDateCreated`	TEXT NOT NULL,
                                          PRIMARY KEY(`sourceId`)
);

INSERT INTO source_ids_mig (sourceId, utcDateCreated)
  SELECT sourceId, REPLACE(dateCreated, 'T', ' ') FROM source_ids;

DROP TABLE source_ids;
ALTER TABLE source_ids_mig RENAME TO source_ids;

CREATE TABLE IF NOT EXISTS "note_revisions_mig" (
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

INSERT INTO note_revisions_mig (noteRevisionId, noteId, title, content, isProtected, utcDateModifiedFrom, utcDateModifiedTo, dateModifiedFrom, dateModifiedTo, type, mime, hash)
SELECT noteRevisionId, noteId, title, content, isProtected, REPLACE(dateModifiedFrom, 'T', ' '), REPLACE(dateModifiedTo, 'T', ' '), REPLACE(REPLACE(dateModifiedFrom, 'T', ' '), 'Z', '+0000'), REPLACE(REPLACE(dateModifiedTo, 'T', ' '), 'Z', '+0000'), type, mime, hash FROM note_revisions;

DROP TABLE note_revisions;
ALTER TABLE note_revisions_mig RENAME TO note_revisions;

CREATE TABLE IF NOT EXISTS "api_tokens_mig"
(
  apiTokenId TEXT PRIMARY KEY NOT NULL,
  token TEXT NOT NULL,
  utcDateCreated TEXT NOT NULL,
  isDeleted INT NOT NULL DEFAULT 0,
  hash TEXT DEFAULT "" NOT NULL);

INSERT INTO api_tokens_mig (apiTokenId, token, utcDateCreated, isDeleted, hash)
  SELECT apiTokenId, token, REPLACE(dateCreated, 'T', ' '), isDeleted, hash FROM api_tokens;

DROP TABLE api_tokens;
ALTER TABLE api_tokens_mig RENAME TO api_tokens;

CREATE TABLE IF NOT EXISTS "branches_mig" (
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

INSERT INTO branches_mig (branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, utcDateModified, utcDateCreated, hash)
  SELECT branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, REPLACE(dateModified, 'T', ' '), REPLACE(dateCreated, 'T', ' '), hash FROM branches;

DROP TABLE branches;
ALTER TABLE branches_mig RENAME TO branches;

CREATE TABLE IF NOT EXISTS "recent_notes_mig" (
                                            `branchId` TEXT NOT NULL PRIMARY KEY,
                                            `notePath` TEXT NOT NULL,
                                            hash TEXT DEFAULT "" NOT NULL,
                                            `utcDateCreated` TEXT NOT NULL,
                                            isDeleted INT
);

INSERT INTO recent_notes_mig (branchId, notePath, hash, utcDateCreated, isDeleted)
  SELECT branchId, notePath, hash, REPLACE(dateCreated, 'T', ' '), isDeleted FROM recent_notes;

DROP TABLE recent_notes;
ALTER TABLE recent_notes_mig RENAME TO recent_notes;

CREATE TABLE IF NOT EXISTS "event_log_mig" (
                                         `eventId`	TEXT NOT NULL PRIMARY KEY,
                                         `noteId`	TEXT,
                                         `comment`	TEXT,
                                         `utcDateCreated`	TEXT NOT NULL
);

INSERT INTO event_log_mig (eventId, noteId, comment, utcDateCreated)
  SELECT eventId, noteId, comment, REPLACE(dateCreated, 'T', ' ') FROM event_log;

DROP TABLE event_log;
ALTER TABLE event_log_mig RENAME TO event_log;

CREATE TABLE IF NOT EXISTS "options_mig"
(
  name TEXT not null PRIMARY KEY,
  value TEXT,
  isSynced INTEGER default 0 not null,
  hash TEXT default "" not null,
  utcDateCreated TEXT not null,
  utcDateModified TEXT NOT NULL
);

INSERT INTO options_mig (name, value, isSynced, hash, utcDateCreated, utcDateModified)
  SELECT name, value, isSynced, hash, REPLACE(dateCreated, 'T', ' '), REPLACE(dateModified, 'T', ' ') FROM options;

DROP TABLE options;
ALTER TABLE options_mig RENAME TO options;

CREATE TABLE attributes_mig
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

INSERT INTO attributes_mig (attributeId, noteId, type, name, value, position, utcDateCreated, utcDateModified, isDeleted, hash, isInheritable)
  SELECT attributeId, noteId, type, name, value, position, REPLACE(dateCreated, 'T', ' '), REPLACE(dateModified, 'T', ' '), isDeleted, hash, isInheritable FROM attributes;

DROP TABLE attributes;
ALTER TABLE attributes_mig RENAME TO attributes;

CREATE TABLE IF NOT EXISTS "links_mig" (
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

INSERT INTO links_mig (linkId, noteId, targetNoteId, type, hash, isDeleted, utcDateCreated, utcDateModified)
  SELECT linkId, noteId, targetNoteId, type, hash, isDeleted, REPLACE(dateCreated, 'T', ' '), REPLACE(dateModified, 'T', ' ') FROM links;

DROP TABLE links;
ALTER TABLE links_mig RENAME TO links;

CREATE TABLE IF NOT EXISTS "note_contents_mig" (
                                             `noteContentId`	TEXT NOT NULL,
                                             `noteId`	TEXT NOT NULL,
                                             `isProtected`	INT NOT NULL DEFAULT 0,
                                             `content`	TEXT NULL DEFAULT NULL,
                                             `hash` TEXT DEFAULT "" NOT NULL,
                                             `utcDateCreated`	TEXT NOT NULL,
                                             `utcDateModified` TEXT NOT NULL,
                                             PRIMARY KEY(`noteContentId`)
);

INSERT INTO note_contents_mig (noteContentId, noteId, isProtected, content, hash, utcDateCreated, utcDateModified)
  SELECT noteContentId, noteId, isProtected, content, hash, REPLACE(dateCreated, 'T', ' '), REPLACE(dateModified, 'T', ' ') FROM note_contents;

DROP TABLE note_contents;
ALTER TABLE note_contents_mig RENAME TO note_contents;

CREATE TABLE IF NOT EXISTS "notes_mig" (
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

INSERT INTO notes_mig (noteId, title, isProtected, type, mime, hash, isDeleted, dateCreated, dateModified, utcDateCreated, utcDateModified)
  SELECT noteId, title, isProtected, type, mime, hash, isDeleted, REPLACE(REPLACE(dateCreated, 'T', ' '), 'Z', '+0000'), REPLACE(REPLACE(dateModified, 'T', ' '), 'Z', '+0000'), REPLACE(dateCreated, 'T', ' '), REPLACE(dateModified, 'T', ' ') FROM notes;

DROP TABLE notes;
ALTER TABLE notes_mig RENAME TO notes;

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
CREATE UNIQUE INDEX `IDX_note_contents_noteId` ON `note_contents` (`noteId`);
