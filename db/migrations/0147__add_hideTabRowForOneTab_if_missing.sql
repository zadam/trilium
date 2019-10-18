INSERT INTO options (name, value, utcDateCreated, utcDateModified, isSynced)
SELECT 'hideTabRowForOneTab', 'false', '2019-05-01T18:31:00.874Z', '2019-05-01T18:31:00.874Z', 0
WHERE NOT EXISTS(SELECT 1 FROM options WHERE name = 'hideTabRowForOneTab');