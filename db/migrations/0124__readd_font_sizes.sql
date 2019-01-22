INSERT INTO options (name, value, dateCreated, dateModified, isSynced)
  SELECT 'mainFontSize', '100', '2019-01-13T18:31:00.874Z', '2019-01-13T18:31:00.874Z', 0
    WHERE NOT EXISTS (SELECT 1 FROM options WHERE name = 'mainFontSize');

INSERT INTO options (name, value, dateCreated, dateModified, isSynced)
  SELECT 'treeFontSize', '100', '2019-01-13T18:31:00.874Z', '2019-01-13T18:31:00.874Z', 0
    WHERE NOT EXISTS (SELECT 1 FROM options WHERE name = 'treeFontSize');

INSERT INTO options (name, value, dateCreated, dateModified, isSynced)
  SELECT 'detailFontSize', '110', '2019-01-13T18:31:00.874Z', '2019-01-13T18:31:00.874Z', 0
    WHERE NOT EXISTS (SELECT 1 FROM options WHERE name = 'detailFontSize');