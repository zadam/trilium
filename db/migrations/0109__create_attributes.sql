create table attributes
(
  attributeId      TEXT not null primary key,
  noteId       TEXT not null,
  type         TEXT not null,
  name         TEXT not null,
  value        TEXT default '' not null,
  position     INT  default 0 not null,
  dateCreated  TEXT not null,
  dateModified TEXT not null,
  isDeleted    INT  not null,
  hash         TEXT default "" not null);

create index IDX_attributes_name_value
  on attributes (name, value);

create index IDX_attributes_value
  on attributes (value);

create index IDX_attributes_noteId
  on attributes (noteId);

INSERT INTO attributes (attributeId, noteId, type, name, value, position, dateCreated, dateModified, isDeleted, hash)
SELECT labelId, noteId, 'label', name, value, position, dateCreated, dateModified, isDeleted, hash FROM labels;

INSERT INTO attributes (attributeId, noteId, type, name, value, position, dateCreated, dateModified, isDeleted, hash)
SELECT relationId, sourceNoteId, 'relation', name, targetNoteId, position, dateCreated, dateModified, isDeleted, hash FROM relations;
