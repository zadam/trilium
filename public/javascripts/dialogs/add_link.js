const addLink = (function() {
    const dialogEl = $("#insert-link-dialog");
    const formEl = $("#insert-link-form");
    const autoCompleteEl = $("#note-autocomplete");
    const noteDetailEl = $('#note-detail');
    const linkTitleEl = $("#link-title");

    function showDialog() {
        noteDetailEl.summernote('editor.saveRange');

        dialogEl.dialog({
            modal: true,
            width: 500
        });

        autoCompleteEl.val('').focus();
        linkTitleEl.val('');

        function setDefaultLinkTitle(noteId) {
            const noteTitle = getNoteTitle(noteId);

            linkTitleEl.val(noteTitle);
        }

        autoCompleteEl.autocomplete({
            source: getAutocompleteItems(glob.allNoteIds),
            minLength: 0,
            change: () => {
                const val = autoCompleteEl.val();
                const noteId = getNodeIdFromLabel(val);

                if (noteId) {
                    setDefaultLinkTitle(noteId);
                }
            },
            // this is called when user goes through autocomplete list with keyboard
            // at this point the item isn't selected yet so we use supplied ui.item to see where the cursor is
            focus: (event, ui) => {
                const noteId = getNodeIdFromLabel(ui.item.value);

                setDefaultLinkTitle(noteId);
            }
        });
    }

    formEl.submit(() => {
        let val = autoCompleteEl.val();

        const noteId = getNodeIdFromLabel(val);

        if (noteId) {
            const linkTitle = linkTitleEl.val();

            dialogEl.dialog("close");

            noteDetailEl.summernote('editor.restoreRange');

            noteDetailEl.summernote('createLink', {
                text: linkTitle,
                url: 'app#' + noteId,
                isNewWindow: true
            });
        }

        return false;
    });

    // when click on link popup, in case of internal link, just go the the referenced note instead of default behavior
    // of opening the link in new window/tab
    $(document).on('click', 'div.popover-content a, div.ui-tooltip-content', goToInternalNote);
    $(document).on('dblclick', '.note-editable a, div.ui-tooltip-content', goToInternalNote);

    function goToInternalNote(e, callback) {
        const targetUrl = $(e.target).attr("href");

        const noteId = getNoteIdFromLink(targetUrl);

        if (noteId !== null) {
            getNodeByKey(noteId).setActive();

            // this is quite ugly hack, but it seems like we can't close the tooltip otherwise
            $("[role='tooltip']").remove();

            e.preventDefault();

            if (callback) {
                callback();
            }
        }
    }

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

    $(document).bind('keydown', 'alt+l', showDialog);

    return {
        showDialog
    };
})();