-- + is normally replaced by X and / by Y, but this can temporarily cause UNIQUE key exception
-- this might create blob duplicates, but cleanup will eventually take care of it

UPDATE blobs SET blobId = REPLACE(blobId, '+', 'A');
UPDATE blobs SET blobId = REPLACE(blobId, '/', 'B');

UPDATE notes SET blobId = REPLACE(blobId, '+', 'A');
UPDATE notes SET blobId = REPLACE(blobId, '/', 'B');

UPDATE attachments SET blobId = REPLACE(blobId, '+', 'A');
UPDATE attachments SET blobId = REPLACE(blobId, '/', 'B');

UPDATE revisions SET blobId = REPLACE(blobId, '+', 'A');
UPDATE revisions SET blobId = REPLACE(blobId, '/', 'B');

UPDATE entity_changes SET entityId = REPLACE(entityId, '+', 'A') WHERE entityName = 'blobs';
UPDATE entity_changes SET entityId = REPLACE(entityId, '/', 'B') WHERE entityName = 'blobs';
