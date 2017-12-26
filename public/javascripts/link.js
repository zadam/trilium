"use strict";

const link = (function() {
    function getNotePathFromLink(url) {
        const notePathMatch = /#([A-Za-z0-9/]+)$/.exec(url);

        if (notePathMatch === null) {
            return null;
        }
        else {
            return notePathMatch[1];
        }
    }

    function getNodePathFromLabel(label) {
        const notePathMatch = / \(([A-Za-z0-9/]+)\)/.exec(label);

        if (notePathMatch !== null) {
            return notePathMatch[1];
        }

        return null;
    }

    function createNoteLink(notePath, noteTitle) {
        if (!noteTitle) {
            const noteId = treeUtils.getNoteIdFromNotePath(notePath);

            noteTitle = noteTree.getNoteTitle(noteId);
        }

        const noteLink = $("<a>", {
            href: 'javascript:',
            text: noteTitle
        }).attr('action', 'note')
            .attr('note-path', notePath);

        return noteLink;
    }

    function goToLink(e) {
        e.preventDefault();

        const linkEl = $(e.target);
        const address = linkEl.attr("note-path") ? linkEl.attr("note-path") : linkEl.attr('href');

        if (!address) {
            return;
        }

        if (address.startsWith('http')) {
            window.open(address, '_blank');

            return;
        }

        const notePath = getNotePathFromLink(address);

        noteTree.activateNode(notePath);

        // this is quite ugly hack, but it seems like we can't close the tooltip otherwise
        $("[role='tooltip']").remove();

        if (glob.activeDialog) {
            try {
                glob.activeDialog.dialog('close');
            }
            catch (e) {}
        }
    }

    function addLinkToEditor(linkTitle, linkHref) {
        const editor = noteEditor.getEditor();
        const doc = editor.document;

        doc.enqueueChanges(() => editor.data.insertLink(linkTitle, linkHref), doc.selection);
    }

    function addTextToEditor(text) {
        const editor = noteEditor.getEditor();
        const doc = editor.document;

        doc.enqueueChanges(() => editor.data.insertText(text), doc.selection);
    }

    // when click on link popup, in case of internal link, just go the the referenced note instead of default behavior
    // of opening the link in new window/tab
    $(document).on('click', "a[action='note']", goToLink);
    $(document).on('click', 'div.popover-content a, div.ui-tooltip-content a', goToLink);
    $(document).on('dblclick', '#note-detail a', goToLink);

    return {
        getNodePathFromLabel,
        getNotePathFromLink,
        createNoteLink,
        addLinkToEditor,
        addTextToEditor
    };
})();