const treeEl = $("#tree");

function getParentKey(node) {
    return (node.getParent() === null || node.getParent().key === "root_1") ? "root" : node.getParent().key;
}

function getParentEncryption(node) {
    return node.getParent() === null ? 0 : node.getParent().data.encryption;
}

function getNodeByKey(noteId) {
    return treeEl.fancytree('getNodeByKey', noteId);
}

function getNoteTitle(noteId) {
    const note = getNodeByKey(noteId);
    if (!note) {
        return;
    }

    let noteTitle = note.title;

    if (noteTitle.endsWith(" (clone)")) {
        noteTitle = noteTitle.substr(0, noteTitle.length - 8);
    }

    return noteTitle;
}

function getFullName(noteId) {
    let note = getNodeByKey(noteId);

    if (note === null) {
        return "[unknown]";
    }

    // why?
    if (note.data.is_clone) {
        return null;
    }

    const path = [];

    while (note) {
        if (note.data.encryption > 0 && !encryption.isEncryptionAvailable()) {
            path.push("[encrypted]");
        }
        else {
            path.push(note.title);
        }

        note = note.getParent();
    }

    // remove "root" element
    path.pop();

    return path.reverse().join(" > ");
}