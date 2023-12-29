UPDATE blobs SET blobId = REPLACE(blobId, '+', 'X');
UPDATE blobs SET blobId = REPLACE(blobId, '/', 'Y');

UPDATE notes SET blobId = REPLACE(blobId, '+', 'X');
UPDATE notes SET blobId = REPLACE(blobId, '/', 'Y');

UPDATE attachments SET blobId = REPLACE(blobId, '+', 'X');
UPDATE attachments SET blobId = REPLACE(blobId, '/', 'Y');

UPDATE revisions SET blobId = REPLACE(blobId, '+', 'X');
UPDATE revisions SET blobId = REPLACE(blobId, '/', 'Y');

UPDATE entity_changes SET entityId = REPLACE(entityId, '+', 'X') WHERE entityName = 'blobs';
UPDATE entity_changes SET entityId = REPLACE(entityId, '/', 'Y') WHERE entityName = 'blobs';
