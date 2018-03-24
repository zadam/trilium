"use strict";

const searchTree = (function() {
    const $tree = $("#tree");
    const $searchInput = $("input[name='search-text']");
    const $resetSearchButton = $("#reset-search-button");
    const $doSearchButton = $("#do-search-button");
    const $saveSearchButton = $("#save-search-button");
    const $searchBox = $("#search-box");
    const $toggleSearchButton = $("#toggle-search-button");

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

    async function doSearch() {
        const searchText = $searchInput.val();

        const noteIds = await server.get('search/' + encodeURIComponent(searchText));

        for (const noteId of noteIds) {
            await noteTree.expandToNote(noteId, {noAnimation: true, noEvents: true});
        }

        // Pass a string to perform case insensitive matching
        getTree().filterBranches(node => noteIds.includes(node.data.noteId));
    }

    $searchInput.keyup(e => {
        const searchText = $searchInput.val();

        if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(searchText) === "") {
            $resetSearchButton.click();
            return;
        }

        if (e && e.which === $.ui.keyCode.ENTER) {
            doSearch();
        }
    }).focus();

    $doSearchButton.click(doSearch);

    $saveSearchButton.click(async () => {
        const {noteId} = await server.post('search/' + encodeURIComponent($searchInput.val()));

        await noteTree.reload();

        await noteTree.activateNode(noteId);
    });

    $(document).bind('keydown', 'ctrl+s', e => {
        toggleSearch();

        e.preventDefault();
    });

    $toggleSearchButton.click(toggleSearch);

    return {
        toggleSearch
    };
})();