"use strict";

const searchTree = (function() {
    const $tree = $("#tree");
    const $searchInput = $("input[name='search-text']");
    const $resetSearchButton = $("button#reset-search-button");
    const $searchBox = $("#search-box");

    $resetSearchButton.click(resetSearch);

    function toggleSearch() {
        if ($searchBox.is(":hidden")) {
            $searchBox.show();
            $searchInput.focus();
        }
        else {
            resetSearch();

            $searchBox.hide();
        }
    }

    function resetSearch() {
        $searchInput.val("");

        getTree().clearFilter();
    }

    function getTree() {
        return $tree.fancytree('getTree');
    }

    $searchInput.keyup(async e => {
        const searchText = $searchInput.val();

        if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(searchText) === "") {
            $resetSearchButton.click();
            return;
        }

        if (e && e.which === $.ui.keyCode.ENTER) {
            const noteIds = await server.get('notes?search=' + encodeURIComponent(searchText));

            for (const noteId of noteIds) {
                await noteTree.expandToNote(noteId, {noAnimation: true, noEvents: true});
            }

            // Pass a string to perform case insensitive matching
            getTree().filterBranches(node => noteIds.includes(node.data.noteId));
        }
    }).focus();

    $(document).bind('keydown', 'ctrl+s', e => {
        toggleSearch();

        e.preventDefault();
    });

    return {
        toggleSearch
    };
})();