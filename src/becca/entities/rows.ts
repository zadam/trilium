// TODO: Booleans should probably be numbers instead (as SQLite does not have booleans.);

export interface AttachmentRow {
    attachmentId?: string;
    ownerId?: string;
    role: string;
    mime: string;
    title: string;
    position?: number;
    blobId?: string;
    isProtected?: boolean;
    dateModified?: string;
    utcDateModified?: string;
    utcDateScheduledForErasureSince?: string;
    contentLength?: number;
    content?: Buffer | string;
}

export interface RevisionRow {
    revisionId?: string;
    noteId: string;
    type: string;
    mime: string;
    isProtected?: boolean;
    title: string;
    blobId?: string;
    dateLastEdited?: string;
    dateCreated: string;
    utcDateLastEdited?: string;
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

export interface EtapiTokenRow {
    etapiTokenId?: string;
    name: string;
    tokenHash: string;
    utcDateCreated?: string;
    utcDateModified?: string;
    isDeleted?: boolean;
}

export interface BlobRow {
    blobId: string;
    content: string | Buffer;
    contentLength: number;
    dateModified: string;
    utcDateModified: string;
}

export type AttributeType = "label" | "relation" | "label-definition" | "relation-definition";

export interface AttributeRow {
    attributeId?: string;
    noteId?: string;
    type: AttributeType;
    name: string;
    position?: number;
    value?: string;
    isInheritable?: boolean;
    utcDateModified?: string;
}

export interface BranchRow {
    branchId?: string;
    noteId: string;
    parentNoteId: string;
    prefix?: string | null;
    notePosition?: number | null;
    isExpanded?: boolean;
    isDeleted?: boolean;
    utcDateModified?: string;
}

/**
 * There are many different Note types, some of which are entirely opaque to the
 * end user. Those types should be used only for checking against, they are
 * not for direct use.
 */
export type NoteType = ("file" | "image" | "search" | "noteMap" | "launcher" | "doc" | "contentWidget" | "text" | "relationMap" | "render" | "canvas" | "mermaid" | "book" | "webView" | "code");

export interface NoteRow {
    noteId: string;
    deleteId: string;
    title: string;
    type: NoteType;
    mime: string;
    isProtected: boolean;
    isDeleted: boolean;
    blobId: string;
    dateCreated: string;
    dateModified: string;
    utcDateCreated: string;
    utcDateModified: string;
    content?: string;
}
