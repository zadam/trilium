"use strict";

const searchTree = (function() {
    const treeEl = $("#tree");
    const searchInputEl = $("input[name='search-text']");
    const resetSearchButton = $("button#reset-search-button");
    const searchBoxEl = $("#search-box");

    resetSearchButton.click(resetSearch);

    function toggleSearch() {
        if (searchBoxEl.is(":hidden")) {
            searchBoxEl.show();
            searchInputEl.focus();
        }
        else {
            resetSearch();

            searchBoxEl.hide();
        }
    }

    function resetSearch() {
        searchInputEl.val("");

        getTree().clearFilter();
    }

    function getTree() {
        return treeEl.fancytree('getTree');
    }

    searchInputEl.keyup(async e => {
        const searchText = searchInputEl.val();

        if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(searchText) === "") {
            resetSearchButton.click();
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