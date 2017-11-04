const link = (function() {
    function getNoteIdFromLink(url) {
        const noteIdMatch = /app#([A-Za-z0-9]{12})/.exec(url);

        if (noteIdMatch === null) {
            return null;
        }
        else {
            return noteIdMatch[1];
        }
    }

    function getNodeIdFromLabel(label) {
        const noteIdMatch = / \(([A-Za-z0-9]{12})\)/.exec(label);

        if (noteIdMatch !== null) {
            return noteIdMatch[1];
        }

        return null;
    }

    function createNoteLink(noteId) {
        const noteLink = $("<a>", {
            href: 'javascript:',
            text: getFullName(noteId)
        }).attr('action', 'note')
            .attr('note-id', noteId);

        return noteLink;
    }

    function goToInternalNote(e) {
        const linkEl = $(e.target);
        let noteId = linkEl.attr("note-id");

        if (!noteId) {
            noteId = getNoteIdFromLink(linkEl.attr('href'));
        }

        if (noteId) {
            getNodeByKey(noteId).setActive();

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
        getNodeIdFromLabel,
        getNoteIdFromLink,
        createNoteLink
    };
})();