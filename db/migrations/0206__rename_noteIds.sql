UPDATE notes SET noteId = 'globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE notes SET noteId = 'bulkAction' WHERE noteId = 'bulkaction';
UPDATE notes SET noteId = 'sqlConsole' WHERE noteId = 'sqlconsole';

UPDATE branches SET branchId = 'globalNoteMap' WHERE branchId = 'globalnotemap';
UPDATE branches SET branchId = 'bulkAction' WHERE branchId = 'bulkaction';
UPDATE branches SET branchId = 'sqlConsole' WHERE branchId = 'sqlconsole';

UPDATE branches SET parentNoteId = 'globalNoteMap' WHERE parentNoteId = 'globalnotemap';
UPDATE branches SET parentNoteId = 'bulkAction' WHERE parentNoteId = 'bulkaction';
UPDATE branches SET parentNoteId = 'sqlConsole' WHERE parentNoteId = 'sqlconsole';

UPDATE attributes SET noteId = 'globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE attributes SET noteId = 'bulkAction' WHERE noteId = 'bulkaction';
UPDATE attributes SET noteId = 'sqlConsole' WHERE noteId = 'sqlconsole';
