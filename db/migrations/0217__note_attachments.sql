CREATE TABLE IF NOT EXISTS "note_attachments"
(
    noteAttachmentId      TEXT not null primary key,
    parentId       TEXT not null,
    role         TEXT not null,
    mime         TEXT not null,
    title         TEXT not null,
    isProtected    INT  not null DEFAULT 0,
    blobId    TEXT not null,
    utcDateModified TEXT not null,
    isDeleted    INT  not null,
    deleteId    TEXT DEFAULT NULL);

CREATE UNIQUE INDEX IDX_note_attachments_parentId_role
    on note_attachments (parentId, role);
