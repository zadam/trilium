INSERT OR REPLACE INTO sync (entityName, entityId, sourceId, syncDate)
SELECT 'note_contents', noteContentId, '', '2019-03-02T18:07:29.182Z' FROM note_contents;