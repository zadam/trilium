CREATE TABLE IF NOT EXISTS "attachments"
(
    attachmentId      TEXT not null primary key,
    parentId       TEXT not null,
    role         TEXT not null,
    mime         TEXT not null,
    title         TEXT not null,
    isProtected    INT  not null DEFAULT 0,
    position     INT  default 0 not null,
    blobId    TEXT DEFAULT null,
    dateModified TEXT NOT NULL,
    utcDateModified TEXT not null,
    utcDateScheduledForDeletionSince TEXT DEFAULT NULL,
    isDeleted    INT  not null,
    deleteId    TEXT DEFAULT NULL);

CREATE INDEX IDX_attachments_parentId_role
    on attachments (parentId, role);
