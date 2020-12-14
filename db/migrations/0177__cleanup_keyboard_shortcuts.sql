DELETE FROM options WHERE name = 'keyboardShortcutsCreateNoteIntoInbox'; -- in case there is already one which shouldn't (except for in-dev documents)
UPDATE options SET name = 'keyboardShortcutsCreateNoteIntoInbox' WHERE name = 'keyboardShortcutsCreateNoteIntoDayNote';

DELETE FROM options WHERE name = 'keyboardShortcutsShowAttributes';
DELETE FROM entity_changes WHERE entityName = 'options' AND entityId = 'keyboardShortcutsShowAttributes';
