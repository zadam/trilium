CREATE TABLE IF NOT EXISTS "etapi_tokens"
(
    etapiTokenId TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    tokenHash TEXT NOT NULL,
    utcDateCreated TEXT NOT NULL,
    utcDateModified TEXT NOT NULL,
    isDeleted INT NOT NULL DEFAULT 0);

INSERT INTO etapi_tokens (etapiTokenId, name, tokenHash, utcDateCreated, utcDateModified, isDeleted)
SELECT apiTokenId, 'Trilium Sender', token, utcDateCreated, utcDateCreated, isDeleted FROM api_tokens;

DROP TABLE api_tokens;

UPDATE entity_changes SET entityName = 'etapi_tokens' WHERE entityName = 'api_tokens';
