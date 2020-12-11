CREATE TABLE IF NOT EXISTS "mig_entity_changes" (
                                                `id`	INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
                                                `entityName`	TEXT NOT NULL,
                                                `entityId`	TEXT NOT NULL,
                                                `hash`	TEXT NOT NULL,
                                                `sourceId` TEXT NOT NULL,
                                                `isSynced` INTEGER NOT NULL);

INSERT INTO mig_entity_changes (entityName, entityId, hash, sourceId, isSynced)
    SELECT entityName, entityId, '', sourceId, isSynced FROM entity_changes;

UPDATE mig_entity_changes SET hash = COALESCE((SELECT hash FROM api_tokens WHERE apiTokenId = entityId), '') WHERE entityName = 'api_tokens';
UPDATE mig_entity_changes SET hash = COALESCE((SELECT hash FROM attributes WHERE attributeId = entityId), '') WHERE entityName = 'attributes';
UPDATE mig_entity_changes SET hash = COALESCE((SELECT hash FROM branches WHERE branchId = entityId), '') WHERE entityName = 'branches';
UPDATE mig_entity_changes SET hash = COALESCE((SELECT hash FROM notes WHERE noteId = entityId), '') WHERE entityName = 'notes';
UPDATE mig_entity_changes SET hash = COALESCE((SELECT hash FROM note_contents WHERE noteId = entityId), '') WHERE entityName = 'note_contents';
UPDATE mig_entity_changes SET hash = COALESCE((SELECT hash FROM note_revisions WHERE noteRevisionId = entityId), '') WHERE entityName = 'note_revisions';
UPDATE mig_entity_changes SET hash = COALESCE((SELECT hash FROM note_revision_contents WHERE noteRevisionId = entityId), '') WHERE entityName = 'note_revision_contents';
UPDATE mig_entity_changes SET hash = COALESCE((SELECT hash FROM options WHERE name = entityId), '') WHERE entityName = 'options';
UPDATE mig_entity_changes SET hash = COALESCE((SELECT hash FROM recent_notes WHERE noteId = entityId), '') WHERE entityName = 'recent_notes';

DROP TABLE entity_changes;
ALTER TABLE mig_entity_changes RENAME TO entity_changes;

CREATE UNIQUE INDEX `IDX_entityChanges_entityName_entityId` ON "entity_changes" (
                                                                                 `entityName`,
                                                                                 `entityId`
    );

CREATE TABLE IF NOT EXISTS "mig_api_tokens"
(
    apiTokenId TEXT PRIMARY KEY NOT NULL,
    token TEXT NOT NULL,
    utcDateCreated TEXT NOT NULL,
    isDeleted INT NOT NULL DEFAULT 0);

INSERT INTO mig_api_tokens (apiTokenId, token, utcDateCreated, isDeleted)
SELECT apiTokenId, token, utcDateCreated, isDeleted FROM api_tokens;

CREATE TABLE IF NOT EXISTS "mig_attributes"
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
    isInheritable int DEFAULT 0 NULL);

INSERT INTO mig_attributes (attributeId, noteId, type, name, value, position, utcDateCreated, utcDateModified, isDeleted, deleteId, isInheritable)
SELECT attributeId, noteId, type, name, value, position, utcDateCreated, utcDateModified, isDeleted, deleteId, isInheritable FROM attributes;

DROP TABLE attributes;
ALTER TABLE mig_attributes RENAME TO attributes;

CREATE INDEX IDX_attributes_name_value
    on attributes (name, value);
CREATE INDEX IDX_attributes_noteId_index
    on attributes (noteId);
CREATE INDEX IDX_attributes_value_index
    on attributes (value);

CREATE TABLE IF NOT EXISTS "mig_branches" (
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
                                          PRIMARY KEY(`branchId`));

INSERT INTO mig_branches (branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, deleteId, utcDateModified, utcDateCreated)
SELECT branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, deleteId, utcDateModified, utcDateCreated FROM branches;

DROP TABLE branches;
ALTER TABLE mig_branches RENAME TO branches;

CREATE INDEX `IDX_branches_noteId_parentNoteId` ON `branches` (`noteId`,`parentNoteId`);
CREATE INDEX IDX_branches_parentNoteId ON branches (parentNoteId);

CREATE TABLE IF NOT EXISTS "mig_notes" (
                                       `noteId`	TEXT NOT NULL,
                                       `title`	TEXT NOT NULL DEFAULT "note",
                                       `isProtected`	INT NOT NULL DEFAULT 0,
                                       `type` TEXT NOT NULL DEFAULT 'text',
                                       `mime` TEXT NOT NULL DEFAULT 'text/html',
                                       `isDeleted`	INT NOT NULL DEFAULT 0,
                                       `deleteId`   TEXT DEFAULT NULL,
                                       `isErased`	INT NOT NULL DEFAULT 0,
                                       `dateCreated`	TEXT NOT NULL,
                                       `dateModified`	TEXT NOT NULL,
                                       `utcDateCreated`	TEXT NOT NULL,
                                       `utcDateModified`	TEXT NOT NULL,
                                       PRIMARY KEY(`noteId`));

INSERT INTO mig_notes (noteId, title, isProtected, type, mime, isDeleted, deleteId, isErased, dateCreated, dateModified, utcDateCreated, utcDateModified)
SELECT noteId, title, isProtected, type, mime, isDeleted, deleteId, isErased, dateCreated, dateModified, utcDateCreated, utcDateModified FROM notes;

DROP TABLE notes;
ALTER TABLE mig_notes RENAME TO notes;

CREATE INDEX `IDX_notes_isDeleted` ON `notes` (`isDeleted`);
CREATE INDEX `IDX_notes_title` ON `notes` (`title`);
CREATE INDEX `IDX_notes_type` ON `notes` (`type`);
CREATE INDEX `IDX_notes_dateCreated` ON `notes` (`dateCreated`);
CREATE INDEX `IDX_notes_dateModified` ON `notes` (`dateModified`);
CREATE INDEX `IDX_notes_utcDateModified` ON `notes` (`utcDateModified`);
CREATE INDEX `IDX_notes_utcDateCreated` ON `notes` (`utcDateCreated`);

CREATE TABLE IF NOT EXISTS "mig_note_contents" (
                                               `noteId`	TEXT NOT NULL,
                                               `content`	TEXT NULL DEFAULT NULL,
                                               `dateModified` TEXT NOT NULL,
                                               `utcDateModified` TEXT NOT NULL,
                                               PRIMARY KEY(`noteId`)
);

INSERT INTO mig_note_contents (noteId, content, dateModified, utcDateModified)
SELECT noteId, content, dateModified, utcDateModified FROM note_contents;

DROP TABLE note_contents;
ALTER TABLE mig_note_contents RENAME TO note_contents;

CREATE TABLE IF NOT EXISTS "mig_note_revisions" (`noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
                                             `noteId`	TEXT NOT NULL,
                                             type TEXT DEFAULT '' NOT NULL,
                                             mime TEXT DEFAULT '' NOT NULL,
                                             `title`	TEXT,
                                             `isErased`	INT NOT NULL DEFAULT 0,
                                             `isProtected`	INT NOT NULL DEFAULT 0,
                                             `utcDateLastEdited` TEXT NOT NULL,
                                             `utcDateCreated` TEXT NOT NULL,
                                             `utcDateModified` TEXT NOT NULL,
                                             `dateLastEdited` TEXT NOT NULL,
                                             `dateCreated` TEXT NOT NULL);

INSERT INTO mig_note_revisions (noteRevisionId, noteId, type, mime, title, isErased, isProtected, utcDateLastEdited, utcDateCreated, utcDateModified, dateLastEdited, dateCreated)
SELECT noteRevisionId, noteId, type, mime, title, isErased, isProtected, utcDateLastEdited, utcDateCreated, utcDateModified, dateLastEdited, dateCreated FROM note_revisions;

DROP TABLE note_revisions;
ALTER TABLE mig_note_revisions RENAME TO note_revisions;

CREATE INDEX `IDX_note_revisions_noteId` ON `note_revisions` (`noteId`);
CREATE INDEX `IDX_note_revisions_utcDateCreated` ON `note_revisions` (`utcDateCreated`);
CREATE INDEX `IDX_note_revisions_utcDateLastEdited` ON `note_revisions` (`utcDateLastEdited`);
CREATE INDEX `IDX_note_revisions_dateCreated` ON `note_revisions` (`dateCreated`);
CREATE INDEX `IDX_note_revisions_dateLastEdited` ON `note_revisions` (`dateLastEdited`);

CREATE TABLE IF NOT EXISTS "mig_note_revision_contents" (`noteRevisionId`	TEXT NOT NULL PRIMARY KEY,
                                                     `content`	TEXT,
                                                     `utcDateModified` TEXT NOT NULL);

INSERT INTO mig_note_revision_contents (noteRevisionId, content, utcDateModified)
SELECT noteRevisionId, content, utcDateModified FROM note_revision_contents;

DROP TABLE note_revision_contents;
ALTER TABLE mig_note_revision_contents RENAME TO note_revision_contents;

CREATE TABLE IF NOT EXISTS "mig_options"
(
    name TEXT not null PRIMARY KEY,
    value TEXT,
    isSynced INTEGER default 0 not null,
    utcDateCreated TEXT not null,
    utcDateModified TEXT NOT NULL
);

INSERT INTO mig_options (name, value, isSynced, utcDateCreated, utcDateModified)
SELECT name, value, isSynced, utcDateCreated, utcDateModified FROM options;

DROP TABLE options;
ALTER TABLE mig_options RENAME TO options;

CREATE TABLE mig_recent_notes
(
    noteId TEXT not null primary key,
    notePath TEXT not null,
    utcDateCreated TEXT not null,
    isDeleted INT NOT NULL DEFAULT 0
);

INSERT INTO mig_recent_notes (noteId, notePath, utcDateCreated, isDeleted)
SELECT noteId, notePath, utcDateCreated, isDeleted FROM recent_notes;

DROP TABLE recent_notes;
ALTER TABLE mig_recent_notes RENAME TO recent_notes;
