CREATE INDEX IF NOT EXISTS IDX_notes_blobId on notes (blobId);
CREATE INDEX IF NOT EXISTS IDX_revisions_blobId on revisions (blobId);
CREATE INDEX IF NOT EXISTS IDX_attachments_blobId on attachments (blobId);
