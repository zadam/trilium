UPDATE options SET name = 'openNoteContexts' WHERE name = 'openTabs';
UPDATE entity_changes SET entityId = 'openNoteContexts' WHERE entityName = 'options' AND entityId = 'openTabs';
