"use strict";

const link = (function() {
    function getNotePathFromLink(url) {
        const notePathMatch = /app#([A-Za-z0-9/]+)$/.exec(url);

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

    function goToInternalNote(e) {
        const linkEl = $(e.target);
        let noteId = linkEl.attr("note-path");

        if (!noteId) {
            noteId = getNotePathFromLink(linkEl.attr('href'));
        }

        if (noteId) {
            noteTree.activateNode(noteId);

            // this is quite ugly hack, but it seems like we can't close the tooltip otherwise
            $("[role='tooltip']").remove();

            if (glob.activeDialog) {
                try {
                    glob.activeDialog.dialog('close');
                }
                catch (e) {}
            }

            e.preventDefault();
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
    $(document).on('click', "a[action='note']", goToInternalNote);
    $(document).on('click', 'div.popover-content a, div.ui-tooltip-content', goToInternalNote);
    $(document).on('dblclick', '#note-detail a, div.ui-tooltip-content', goToInternalNote);

    return {
        getNodePathFromLabel,
        getNotePathFromLink,
        createNoteLink,
        addLinkToEditor,
        addTextToEditor
    };
})();