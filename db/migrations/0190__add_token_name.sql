CREATE TABLE IF NOT EXISTS "mig_api_tokens"
(
    apiTokenId TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    token TEXT NOT NULL,
    utcDateCreated TEXT NOT NULL,
    isDeleted INT NOT NULL DEFAULT 0);

INSERT INTO mig_api_tokens (apiTokenId, name, token, utcDateCreated, isDeleted) 
SELECT apiTokenId, 'Trilium Sender', token, utcDateCreated, isDeleted FROM api_tokens;

DROP TABLE api_tokens;

ALTER TABLE mig_api_tokens RENAME TO api_tokens;
