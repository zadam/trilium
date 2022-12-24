UPDATE notes SET noteId = '_globalNoteMap', title = 'Note Map' WHERE noteId = 'globalnotemap';
UPDATE note_contents SET noteId = '_globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE note_revisions SET noteId = '_globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE branches SET noteId = '_globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE branches SET parentNoteId = '_globalNoteMap' WHERE parentNoteId = 'globalnotemap';
UPDATE attributes SET noteId = '_globalNoteMap' WHERE noteId = 'globalnotemap';
UPDATE attributes SET value = '_globalNoteMap' WHERE type = 'relation' AND value = 'globalnotemap';
UPDATE entity_changes SET entityId = '_globalNoteMap' WHERE entityId = 'globalnotemap';

UPDATE notes SET noteId = '_bulkAction', title = 'Bulk Action' WHERE noteId = 'bulkaction';
UPDATE note_contents SET noteId = '_bulkAction' WHERE noteId = 'bulkaction';
UPDATE note_revisions SET noteId = '_bulkAction' WHERE noteId = 'bulkaction';
UPDATE branches SET parentNoteId = '_bulkAction' WHERE parentNoteId = 'bulkaction';
UPDATE branches SET noteId = '_bulkAction' WHERE noteId = 'bulkaction';
UPDATE attributes SET noteId = '_bulkAction' WHERE noteId = 'bulkaction';
UPDATE attributes SET value = '_bulkAction' WHERE type = 'relation' AND value = 'bulkaction';
UPDATE entity_changes SET entityId = '_bulkAction' WHERE entityId = 'bulkaction';

UPDATE notes SET noteId = '_sqlConsole', title = 'SQL Console History' WHERE noteId = 'sqlconsole';
UPDATE note_contents SET noteId = '_sqlConsole' WHERE noteId = 'sqlconsole';
UPDATE note_revisions SET noteId = '_sqlConsole' WHERE noteId = 'sqlconsole';
UPDATE branches SET noteId = '_sqlConsole' WHERE noteId = 'sqlconsole';
UPDATE branches SET parentNoteId = '_sqlConsole' WHERE parentNoteId = 'sqlconsole';
UPDATE attributes SET noteId = '_sqlConsole' WHERE noteId = 'sqlconsole';
UPDATE attributes SET value = '_sqlConsole' WHERE type = 'relation' AND value = 'sqlconsole';
UPDATE entity_changes SET entityId = '_sqlConsole' WHERE entityId = 'sqlconsole';

UPDATE notes SET noteId = '_hidden', title = 'Hidden Notes' WHERE noteId = 'hidden';
UPDATE note_contents SET noteId = '_hidden' WHERE noteId = 'hidden';
UPDATE note_revisions SET noteId = '_hidden' WHERE noteId = 'hidden';
UPDATE branches SET noteId = '_hidden', prefix = NULL WHERE noteId = 'hidden';
UPDATE branches SET parentNoteId = '_hidden' WHERE parentNoteId = 'hidden';
UPDATE attributes SET noteId = '_hidden' WHERE noteId = 'hidden';
UPDATE attributes SET value = '_hidden' WHERE type = 'relation' AND value = 'hidden';
UPDATE entity_changes SET entityId = '_hidden' WHERE entityId = 'hidden';

UPDATE notes SET noteId = '_search', title = 'Search History' WHERE noteId = 'search';
UPDATE note_contents SET noteId = '_search' WHERE noteId = 'search';
UPDATE note_revisions SET noteId = '_search' WHERE noteId = 'search';
UPDATE branches SET noteId = '_search' WHERE noteId = 'search';
UPDATE branches SET parentNoteId = '_search' WHERE parentNoteId = 'search';
UPDATE attributes SET noteId = '_search' WHERE noteId = 'search';
UPDATE attributes SET value = '_search' WHERE type = 'relation' AND value = 'search';
UPDATE entity_changes SET entityId = '_search' WHERE entityId = 'search';

UPDATE notes SET noteId = '_share', title = 'Shared Notes' WHERE noteId = 'share';
UPDATE note_contents SET noteId = '_share' WHERE noteId = 'share';
UPDATE note_revisions SET noteId = '_share' WHERE noteId = 'share';
UPDATE branches SET noteId = '_share' WHERE noteId = 'share';
UPDATE branches SET parentNoteId = '_share' WHERE parentNoteId = 'share';
UPDATE attributes SET noteId = '_share' WHERE noteId = 'share';
UPDATE attributes SET value = '_share' WHERE type = 'relation' AND value = 'share';
UPDATE entity_changes SET entityId = '_share' WHERE entityId = 'share';
