CREATE TABLE relations
(
    relationId  TEXT not null primary key,
    sourceNoteId       TEXT not null,
    name         TEXT not null,
    targetNoteId        TEXT not null,
    position     INT  default 0 not null,
    dateCreated  TEXT not null,
    dateModified TEXT not null,
    isDeleted    INT  not null
  , hash TEXT DEFAULT "" NOT NULL);
CREATE INDEX IDX_relation_sourceNoteId
  on relations (sourceNoteId);
CREATE INDEX IDX_relation_targetNoteId
  on relations (targetNoteId);