CREATE TABLE IF NOT EXISTS "notes_mig" (
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

INSERT INTO notes_mig (noteId, title, contentLength, isProtected, type, mime, hash, isDeleted, isErased, dateCreated, dateModified, utcDateCreated, utcDateModified)
SELECT noteId, title, -1, isProtected, type, mime, hash, isDeleted, isErased, dateCreated, dateModified, utcDateCreated, utcDateModified FROM notes;

DROP TABLE notes;
ALTER TABLE notes_mig RENAME TO notes;

CREATE INDEX `IDX_notes_isDeleted` ON `notes` (`isDeleted`);
CREATE INDEX `IDX_notes_title` ON `notes` (`title`);
CREATE INDEX `IDX_notes_type` ON `notes` (`type`);
CREATE INDEX `IDX_notes_dateCreated` ON `notes` (`dateCreated`);
CREATE INDEX `IDX_notes_dateModified` ON `notes` (`dateModified`);
CREATE INDEX `IDX_notes_utcDateModified` ON `notes` (`utcDateModified`);
CREATE INDEX `IDX_notes_utcDateCreated` ON `notes` (`utcDateCreated`);

CREATE TABLE IF NOT EXISTS "branches_mig" (
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

INSERT INTO branches_mig (branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, utcDateModified, utcDateCreated, hash)
    SELECT branchId, noteId, parentNoteId, notePosition, prefix, isExpanded, isDeleted, utcDateModified, utcDateCreated, hash FROM branches;

DROP TABLE branches;
ALTER TABLE branches_mig RENAME TO branches;

CREATE INDEX `IDX_branches_noteId_parentNoteId` ON `branches` (`noteId`,`parentNoteId`);
CREATE INDEX IDX_branches_parentNoteId ON branches (parentNoteId);

CREATE TABLE IF NOT EXISTS "attributes_mig"
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

INSERT INTO attributes_mig (attributeId, noteId, type, name, value, position, utcDateCreated, utcDateModified, isDeleted, hash, isInheritable)
SELECT attributeId, noteId, type, name, value, position, utcDateCreated, utcDateModified, isDeleted, hash, isInheritable FROM attributes;

DROP TABLE attributes;
ALTER TABLE attributes_mig RENAME TO attributes;

CREATE INDEX IDX_attributes_name_value
    on attributes (name, value);
CREATE INDEX IDX_attributes_noteId_index
    on attributes (noteId);
CREATE INDEX IDX_attributes_value_index
    on attributes (value);
