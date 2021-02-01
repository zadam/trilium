UPDATE options SET name = 'keyboardShortcutsQuickSearch' WHERE name = 'keyboardShortcutsSearchNotes';
UPDATE entity_changes SET entityId = 'keyboardShortcutsQuickSearch' WHERE entityId = 'keyboardShortcutsSearchNotes' AND entityName = 'options';
