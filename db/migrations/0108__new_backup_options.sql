UPDATE options SET name = 'lastDailyBackupDate' WHERE name = 'lastBackupDate';

INSERT INTO options (name, value, dateCreated, dateModified, isSynced)
VALUES ('lastWeeklyBackupDate', '2018-07-29T18:31:00.874Z', '2018-07-29T18:31:00.874Z', '2018-07-29T18:31:00.874Z', 0);

INSERT INTO options (name, value, dateCreated, dateModified, isSynced)
VALUES ('lastMonthlyBackupDate', '2018-07-29T18:31:00.874Z', '2018-07-29T18:31:00.874Z', '2018-07-29T18:31:00.874Z', 0);

-- these options are not synced so no need to fix sync rows