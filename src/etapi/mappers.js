/** @param {BNote} note */
function mapNoteToPojo(note) {
    return {
        noteId: note.noteId,
        isProtected: note.isProtected,
        title: note.title,
        type: note.type,
        mime: note.mime,
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

/** @param {BBranch} branch */
function mapBranchToPojo(branch) {
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

/** @param {BAttribute} attr */
function mapAttributeToPojo(attr) {
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

module.exports = {
    mapNoteToPojo,
    mapBranchToPojo,
    mapAttributeToPojo
};
