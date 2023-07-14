CREATE TABLE IF NOT EXISTS "attachments"
(
    attachmentId      TEXT not null primary key,
    ownerId       TEXT not null,
    role         TEXT not null,
    mime         TEXT not null,
    title         TEXT not null,
    isProtected    INT  not null DEFAULT 0,
    position     INT  default 0 not null,
    blobId    TEXT DEFAULT null,
    dateModified TEXT NOT NULL,
    utcDateModified TEXT not null,
    utcDateScheduledForErasureSince TEXT DEFAULT NULL,
    isDeleted    INT  not null,
    deleteId    TEXT DEFAULT NULL);

CREATE INDEX IDX_attachments_ownerId_role
    on attachments (ownerId, role);

CREATE INDEX IDX_attachments_utcDateScheduledForErasureSince
    on attachments (utcDateScheduledForErasureSince);
