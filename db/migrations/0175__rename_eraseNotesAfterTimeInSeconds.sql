UPDATE options SET name = 'eraseEntitiesAfterTimeInSeconds' WHERE name = 'eraseNotesAfterTimeInSeconds';
UPDATE entity_changes SET entityId = 'eraseEntitiesAfterTimeInSeconds' WHERE entityName = 'options' AND entityId = 'eraseNotesAfterTimeInSeconds';
