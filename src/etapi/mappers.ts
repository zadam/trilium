import BAttachment = require("../becca/entities/battachment");
import BAttribute = require("../becca/entities/battribute");
import BBranch = require("../becca/entities/bbranch");
import BNote = require("../becca/entities/bnote");

function mapNoteToPojo(note: BNote) {
    return {
        noteId: note.noteId,
        isProtected: note.isProtected,
        title: note.title,
        type: note.type,
        mime: note.mime,
        blobId: note.blobId,
        dateCreated: note.dateCreated,
        dateModified: note.dateModified,
        utcDateCreated: note.utcDateCreated,
        utcDateModified: note.utcDateModified,
        parentNoteIds: note.getParentNotes().map(p => p.noteId),
        childNoteIds: note.getChildNotes().map(ch => ch.noteId),
        parentBranchIds: note.getParentBranches().map(p => p.branchId),
        childBranchIds: note.getChildBranches().map(ch => ch.branchId),
        attributes: note.getAttributes().map(attr => mapAttributeToPojo(attr))
    };
}

function mapBranchToPojo(branch: BBranch) {
    return {
        branchId: branch.branchId,
        noteId: branch.noteId,
        parentNoteId: branch.parentNoteId,
        prefix: branch.prefix,
        notePosition: branch.notePosition,
        isExpanded: branch.isExpanded,
        utcDateModified: branch.utcDateModified
    };
}

function mapAttributeToPojo(attr: BAttribute) {
    return {
        attributeId: attr.attributeId,
        noteId: attr.noteId,
        type: attr.type,
        name: attr.name,
        value: attr.value,
        position: attr.position,
        isInheritable: attr.isInheritable,
        utcDateModified: attr.utcDateModified
    };
}

function mapAttachmentToPojo(attachment: BAttachment) {
    return {
        attachmentId: attachment.attachmentId,
        ownerId: attachment.ownerId,
        role: attachment.role,
        mime: attachment.mime,
        title: attachment.title,
        position: attachment.position,
        blobId: attachment.blobId,
        dateModified: attachment.dateModified,
        utcDateModified: attachment.utcDateModified,
        utcDateScheduledForErasureSince: attachment.utcDateScheduledForErasureSince,
        contentLength: attachment.contentLength
    };
}

export = {
    mapNoteToPojo,
    mapBranchToPojo,
    mapAttributeToPojo,
    mapAttachmentToPojo
};
