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

    function createNoteLink(noteId) {
        const noteLink = $("<a>", {
            href: 'javascript:',
            text: noteTree.getNoteTitle(noteId)
        }).attr('action', 'note')
            .attr('note-id', noteId);

        return noteLink;
    }

    function goToInternalNote(e) {
        const linkEl = $(e.target);
        let noteId = linkEl.attr("note-id");

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

    // when click on link popup, in case of internal link, just go the the referenced note instead of default behavior
    // of opening the link in new window/tab
    $(document).on('click', "a[action='note']", goToInternalNote);
    $(document).on('click', 'div.popover-content a, div.ui-tooltip-content', goToInternalNote);
    $(document).on('dblclick', '.note-editable a, div.ui-tooltip-content', goToInternalNote);

    return {
        getNodePathFromLabel,
        getNotePathFromLink,
        createNoteLink
    };
})();