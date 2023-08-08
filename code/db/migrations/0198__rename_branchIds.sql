UPDATE branches SET branchId = '_hidden__search' WHERE parentNoteId = 'hidden' AND noteId = 'search' AND isDeleted = 0;
UPDATE branches SET branchId = 'root__globalNoteMap' WHERE parentNoteId = 'singles' AND noteId = 'globalnotemap' AND isDeleted = 0;
UPDATE branches SET branchId = '_hidden__sqlConsole' WHERE parentNoteId = 'hidden' AND noteId = 'sqlconsole' AND isDeleted = 0;
UPDATE branches SET branchId = 'root__hidden' WHERE parentNoteId = 'root' AND noteId = 'hidden' AND isDeleted = 0;
UPDATE branches SET branchId = '_hidden__bulkAction' WHERE parentNoteId = 'hidden' AND noteId = 'bulkaction' AND isDeleted = 0;
UPDATE branches SET branchId = '_hidden__share' WHERE parentNoteId = 'root' AND noteId = 'share' AND isDeleted = 0;
