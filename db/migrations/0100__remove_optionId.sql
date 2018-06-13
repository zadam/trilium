create table options_mig
(
  name TEXT not null PRIMARY KEY,
  value TEXT,
  dateModified INT,
  isSynced INTEGER default 0 not null,
  hash TEXT default "" not null,
  dateCreated TEXT default '1970-01-01T00:00:00.000Z' not null
);

INSERT INTO options_mig (name, value, dateModified, isSynced, hash, dateCreated)
SELECT name, value, dateModified, isSynced, hash, dateCreated FROM options;

DROP TABLE options;
ALTER TABLE options_mig RENAME TO options;