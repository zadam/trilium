UPDATE notes SET noteId = 'globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE notes SET noteId = 'bulkAction' WHERE noteId = 'bulkaction';
UPDATE notes SET noteId = 'sqlConsole' WHERE noteId = 'sqlconsole';

UPDATE note_contents SET noteId = 'globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE note_contents SET noteId = 'bulkAction' WHERE noteId = 'bulkaction';
UPDATE note_contents SET noteId = 'sqlConsole' WHERE noteId = 'sqlconsole';

UPDATE note_revisions SET noteId = 'globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE note_revisions SET noteId = 'bulkAction' WHERE noteId = 'bulkaction';
UPDATE note_revisions SET noteId = 'sqlConsole' WHERE noteId = 'sqlconsole';

UPDATE branches SET branchId = 'globalNoteMap' WHERE branchId = 'globalnotemap';
UPDATE branches SET branchId = 'bulkAction' WHERE branchId = 'bulkaction';
UPDATE branches SET branchId = 'sqlConsole' WHERE branchId = 'sqlconsole';

UPDATE branches SET noteId = 'globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE branches SET noteId = 'bulkAction' WHERE noteId = 'bulkaction';
UPDATE branches SET noteId = 'sqlConsole' WHERE noteId = 'sqlconsole';

UPDATE branches SET parentNoteId = 'globalNoteMap' WHERE parentNoteId = 'globalnotemap';
UPDATE branches SET parentNoteId = 'bulkAction' WHERE parentNoteId = 'bulkaction';
UPDATE branches SET parentNoteId = 'sqlConsole' WHERE parentNoteId = 'sqlconsole';

UPDATE attributes SET noteId = 'globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE attributes SET noteId = 'bulkAction' WHERE noteId = 'bulkaction';
UPDATE attributes SET noteId = 'sqlConsole' WHERE noteId = 'sqlconsole';

UPDATE attributes SET value = 'globalNoteMap' WHERE type = 'relation' AND value = 'globalnotemap';
UPDATE attributes SET value = 'bulkAction' WHERE type = 'relation' AND value = 'bulkaction';
UPDATE attributes SET value = 'sqlConsole' WHERE type = 'relation' AND value = 'sqlconsole';

UPDATE entity_changes SET entityId = 'globalNoteMap' WHERE entityId = 'globalnotemap';
UPDATE entity_changes SET entityId = 'bulkAction' WHERE entityId = 'bulkaction';
UPDATE entity_changes SET entityId = 'sqlConsole' WHERE entityId = 'sqlconsole';
