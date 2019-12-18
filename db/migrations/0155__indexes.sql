DROP INDEX IF EXISTS IDX_attributes_name_index;
DROP INDEX IF EXISTS IDX_branches_noteId;

CREATE INDEX IDX_source_ids_utcDateCreated
    on source_ids (utcDateCreated);