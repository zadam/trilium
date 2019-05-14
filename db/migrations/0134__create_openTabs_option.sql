INSERT INTO options (name, value, utcDateCreated, utcDateModified, isSynced)
    SELECT 'openTabs', '[{"notePath":"' || value || '","active": true,"tabId":"1111"}]', '2019-05-01T18:31:00.874Z', '2019-05-01T18:31:00.874Z', 0 FROM options WHERE name = 'startNotePath';

DELETE FROM options WHERE name = 'startNotePath';