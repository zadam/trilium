create table labels
(
  labelId  TEXT not null primary key,
  noteId       TEXT not null,
  name         TEXT not null,
  value        TEXT default '' not null,
  position     INT  default 0 not null,
  dateCreated  TEXT not null,
  dateModified TEXT not null,
  isDeleted    INT  not null
);

create index IDX_labels_name_value
  on labels (name, value);

create index IDX_labels_noteId
  on labels (noteId);

INSERT INTO labels (labelId, noteId, name, "value", "position", dateCreated, dateModified, isDeleted)
  SELECT attributeId, noteId, name, "value", "position", dateCreated, dateModified, isDeleted FROM attributes;

DROP TABLE attributes;