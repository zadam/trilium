"use strict";

const recentNotes = (function() {
    const $dialog = $("#recent-notes-dialog");
    const $searchInput = $('#recent-notes-search-input');

    // list of recent note paths
    let list = [];

    async function reload() {
        const result = await server.get('recent-notes');

        list = result.map(r => r.notePath);
    }

    function addRecentNote(noteTreeId, notePath) {
        setTimeout(async () => {
            // we include the note into recent list only if the user stayed on the note at least 5 seconds
            if (notePath && notePath === noteTree.getCurrentNotePath()) {
                const result = await server.put('recent-notes/' + noteTreeId + '/' + encodeURIComponent(notePath));

                list = result.map(r => r.notePath);
            }
        }, 1500);
    }

    function showDialog() {
        glob.activeDialog = $dialog;

        $dialog.dialog({
            modal: true,
            width: 800,
            height: 400
        });

        $searchInput.val('');

        // remove the current note
        const recNotes = list.filter(note => note !== noteTree.getCurrentNotePath());

        $searchInput.autocomplete({
            source: recNotes.map(notePath => {
                const noteTitle = noteTree.getNotePathTitle(notePath);

                return {
                    label: noteTitle,
                    value: notePath
                }
            }),
            minLength: 0,
            autoFocus: true,
            select: function (event, ui) {
                noteTree.activateNode(ui.item.value);

                $searchInput.autocomplete('destroy');
                $dialog.dialog('close');
            },
            focus: function (event, ui) {
                event.preventDefault();
            },
            close: function (event, ui) {
                $searchInput.autocomplete('destroy');
                $dialog.dialog('close');
            },
            create: () => $searchInput.autocomplete("search", ""),
            classes: {
                "ui-autocomplete": "recent-notes-autocomplete"
            }
        });
    }

    reload();

    $(document).bind('keydown', 'ctrl+e', e => {
        showDialog();

        e.preventDefault();
    });

    return {
        showDialog,
        addRecentNote,
        reload
    };
})();