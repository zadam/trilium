function getParentKey(node) {
    return (node.getParent() === null || node.getParent().key === "root_1") ? "root" : node.getParent().key;
}

function getParentEncryption(node) {
    return node.getParent() === null ? 0 : node.getParent().data.encryption;
}

function getNodeByKey(noteId) {
    return globalTree.fancytree('getNodeByKey', noteId);
}

function getFullName(noteId) {
    let note = getNodeByKey(noteId);

    if (note.data.is_clone || (note.data.encryption > 0 && !isEncryptionAvailable())) {
        return null;
    }

    const path = [];

    while (note) {
        path.push(note.title);

        note = note.getParent();
    }

    // remove "root" element
    path.pop();

    return path.reverse().join(" > ");
}