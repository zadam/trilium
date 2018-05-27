CREATE TABLE `event_log_mig` (
  `eventId`	TEXT NOT NULL PRIMARY KEY,
  `noteId`	TEXT,
  `comment`	TEXT,
  `dateCreated`	TEXT NOT NULL
);

INSERT INTO event_log_mig (eventId, noteId, comment, dateCreated)
SELECT id, noteId, comment, dateCreated FROM event_log;

DROP TABLE event_log;
ALTER TABLE event_log_mig RENAME TO event_log;

create table options_mig
(
  optionId TEXT NOT NULL PRIMARY KEY,
  name TEXT not null,
  value TEXT,
  dateModified INT,
  isSynced INTEGER default 0 not null,
  hash TEXT default "" not null,
  dateCreated TEXT default '1970-01-01T00:00:00.000Z' not null
);

INSERT INTO options_mig (optionId, name, value, dateModified, isSynced, hash, dateCreated)
  SELECT name || "_key", name, value, dateModified, isSynced, hash, dateCreated FROM options;

DROP TABLE options;
ALTER TABLE options_mig RENAME TO options;