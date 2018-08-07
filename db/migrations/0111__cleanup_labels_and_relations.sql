DROP TABLE relations;
DROP TABLE labels;

DELETE FROM sync WHERE entityName = 'relations' OR entityName = 'labels';