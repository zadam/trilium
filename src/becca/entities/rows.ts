// FIXME: Booleans should probably be numbers instead (as SQLite does not have booleans.);

export interface AttachmentRow {
    attachmentId?: string;
    ownerId: string;
    role: string;
    mime: string;
    title?: string;
    position?: number;
    blobId: string;
    isProtected?: boolean;
    dateModified?: string;
    utcDateModified?: string;
    utcDateScheduledForErasureSince?: string;
    contentLength?: number;
}

export interface RevisionRow {
    revisionId: string;
    noteId: string;
    type: string;
    mime: string;
    isProtected: boolean;
    title: string;
    blobId: string;
    dateLastEdited: string;
    dateCreated: string;
    utcDateLastEdited: string;
    utcDateCreated: string;
    utcDateModified: string;
    contentLength?: number;
}

export interface RecentNoteRow {
    noteId: string;
    notePath: string;
    utcDateCreated?: string;
}

export interface OptionRow {
    name: string;
    value: string;
    isSynced: boolean;
    utcDateModified: string;
}