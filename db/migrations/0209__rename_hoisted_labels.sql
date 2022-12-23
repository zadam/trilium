UPDATE attributes SET name = 'workspaceInbox' WHERE type = 'label' AND name = 'hoistedInbox';
UPDATE entity_changes SET entityId = 'workspaceInbox' WHERE entityName = 'attributes' AND entityId = 'hoistedInbox';

UPDATE attributes SET name = 'workspaceSearchHome' WHERE type = 'label' AND name = 'hoistedSearchHome';
UPDATE entity_changes SET entityId = 'workspaceSearchHome' WHERE entityName = 'attributes' AND entityId = 'hoistedSearchHome';
