function pasteAfter(node) {
    const subjectNode = getNodeByKey(globalClipboardNoteId);

    moveAfterNode(subjectNode, node);

    globalClipboardNoteId = null;
}

function pasteInto(node) {
    const subjectNode = getNodeByKey(globalClipboardNoteId);

    moveToNode(subjectNode, node);

    globalClipboardNoteId = null;
}

function cut(node) {
    globalClipboardNoteId = node.key;
}

const contextMenuSetup = {
    delegate: "span.fancytree-title",
    autoFocus: true,
    menu: [
        {title: "Insert note here", cmd: "insertNoteHere", uiIcon: "ui-icon-pencil"},
        {title: "Insert child note", cmd: "insertChildNote", uiIcon: "ui-icon-pencil"},
        {title: "Delete", cmd: "delete", uiIcon: "ui-icon-trash"},
        {title: "----"},
        {title: "Encrypt sub-tree", cmd: "encryptSubTree", uiIcon: "ui-icon-locked"},
        {title: "Decrypt sub-tree", cmd: "decryptSubTree", uiIcon: "ui-icon-unlocked"},
        {title: "----"},
        {title: "Cut", cmd: "cut", uiIcon: "ui-icon-scissors"},
        {title: "Copy / clone", cmd: "copy", uiIcon: "ui-icon-copy"},
        {title: "Paste after", cmd: "pasteAfter", uiIcon: "ui-icon-clipboard"},
        {title: "Paste into", cmd: "pasteInto", uiIcon: "ui-icon-clipboard"}
    ],
    beforeOpen: (event, ui) => {
        const node = $.ui.fancytree.getNode(ui.target);
        // Modify menu entries depending on node status
        globalTree.contextmenu("enableEntry", "pasteAfter", globalClipboardNoteId !== null);
        globalTree.contextmenu("enableEntry", "pasteInto", globalClipboardNoteId !== null);

        // Activate node on right-click
        node.setActive();
        // Disable tree keyboard handling
        ui.menu.prevKeyboard = node.tree.options.keyboard;
        node.tree.options.keyboard = false;
    },
    close: (event, ui) => {},
    select: (event, ui) => {
        const node = $.ui.fancytree.getNode(ui.target);

        if (ui.cmd === "insertNoteHere") {
            const parentKey = getParentKey(node);
            const encryption = getParentEncryption(node);

            createNote(node, parentKey, 'after', encryption);
        }
        else if (ui.cmd === "insertChildNote") {
            createNote(node, node.key, 'into');
        }
        else if (ui.cmd === "encryptSubTree") {
            encryptSubTree(node.key);
        }
        else if (ui.cmd === "decryptSubTree") {
            decryptSubTree(node.key);
        }
        else if (ui.cmd === "cut") {
            cut(node);
        }
        else if (ui.cmd === "pasteAfter") {
            pasteAfter(node);
        }
        else if (ui.cmd === "pasteInto") {
            pasteInto(node);
        }
        else if (ui.cmd === "delete") {
            deleteNode(node);
        }
        else {
            console.log("Unknown command: " + ui.cmd);
        }
    }
};
