INSERT INTO options (name, value, utcDateCreated, utcDateModified, isSynced)
VALUES ('codeNotesMimeTypes', '["text/x-csrc","text/x-c++src","text/x-csharp","text/css","text/x-go","text/x-groovy","text/x-haskell","text/html","message/http","text/x-java","application/javascript;env=frontend","application/javascript;env=backend","application/json","text/x-kotlin","text/x-markdown","text/x-perl","text/x-php","text/x-python","text/x-ruby",null,"text/x-sql","text/x-swift","text/xml","text/x-yaml"]', '2018-07-29T18:31:00.874Z', '2018-07-29T18:31:00.874Z', 1);

INSERT INTO sync (entityName, entityId, sourceId, utcSyncDate)
VALUES ('options' ,'codeNotesMimeTypes', 'SYNC_FILL', '2018-01-01T00:00:00.000Z');