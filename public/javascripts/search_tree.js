"use strict";

const searchTree = (function() {
    const treeEl = $("#tree");
    const searchInputEl = $("input[name='search-text']");
    const resetSearchButton = $("button#reset-search-button");
    const searchBoxEl = $("#search-box");

    resetSearchButton.click(resetSearch);

    function showSearch() {
        searchBoxEl.show();
        searchInputEl.focus();
    }

    function toggleSearch() {
        if (searchBoxEl.is(":hidden")) {
            showSearch();
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

    searchInputEl.keyup(e => {
        const searchText = searchInputEl.val();

        if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(searchText) === "") {
            resetSearchButton.click();
            return;
        }

        if (e && e.which === $.ui.keyCode.ENTER) {
            $.get(baseApiUrl + 'notes?search=' + searchText).then(resp => {
                // Pass a string to perform case insensitive matching
                getTree().filterBranches(node => {
                    return resp.includes(node.data.note_id);
                });
            });
        }
    }).focus();

    $(document).bind('keydown', 'alt+s', showSearch);

    return {
        toggleSearch
    };
})();