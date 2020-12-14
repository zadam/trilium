CREATE TABLE IF NOT EXISTS "mig_attributes"
(
    attributeId      TEXT not null primary key,
    noteId       TEXT not null,
    type         TEXT not null,
    name         TEXT not null,
    value        TEXT default '' not null,
    position     INT  default 0 not null,
    utcDateModified TEXT not null,
    isDeleted    INT  not null,
    `deleteId`    TEXT DEFAULT NULL,
    isInheritable int DEFAULT 0 NULL);

INSERT INTO mig_attributes (attributeId, noteId, type, name, value, position, utcDateModified, isDeleted, deleteId, isInheritable)
SELECT attributeId, noteId, type, name, value, position, utcDateModified, isDeleted, deleteId, isInheritable FROM attributes;

DROP TABLE attributes;
ALTER TABLE mig_attributes RENAME TO attributes;

CREATE INDEX IDX_attributes_name_value
    on attributes (name, value);
CREATE INDEX IDX_attributes_noteId_index
    on attributes (noteId);
CREATE INDEX IDX_attributes_value_index
    on attributes (value);
