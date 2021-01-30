UPDATE options SET name = 'eraseEntitiesAfterTimeInSeconds' WHERE name = 'eraseNotesAfterTimeInSeconds';
UPDATE entity_changes SET entityName = 'eraseEntitiesAfterTimeInSeconds' WHERE entityName = 'eraseNotesAfterTimeInSeconds';
