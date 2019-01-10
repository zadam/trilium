import treeService from './tree.js';
import server from './server.js';
import treeUtils from "./tree_utils.js";

const $tree = $("#tree");
const $searchInput = $("input[name='search-text']");
const $resetSearchButton = $("#reset-search-button");
const $doSearchButton = $("#do-search-button");
const $saveSearchButton = $("#save-search-button");
const $searchBox = $("#search-box");
const $searchResults = $("#search-results");
const $searchResultsInner = $("#search-results-inner");
const $closeSearchButton = $("#close-search-button");

function showSearch() {
    $searchBox.show();
    $searchInput.focus();
}

function hideSearch() {
    resetSearch();

    $searchResults.hide();
    $searchBox.hide();
}

function toggleSearch() {
    if ($searchBox.is(":hidden")) {
        showSearch();
    }
    else {
        hideSearch();
    }
}

function resetSearch() {
    $searchInput.val("");
}

function getTree() {
    return $tree.fancytree('getTree');
}

async function doSearch(searchText) {
    if (searchText) {
        $searchInput.val(searchText);
    }
    else {
        searchText = $searchInput.val();
    }

    const results = await server.get('search/' + encodeURIComponent(searchText));

    $searchResultsInner.empty();
    $searchResults.show();

    for (const result of results) {
        const link = $('<a>', {
            href: 'javascript:',
            text: result.title
        }).attr('data-action', 'note').attr('data-note-path', result.path);

        const $result = $('<li>').append(link);

        $searchResultsInner.append($result);
    }
}

async function saveSearch() {
    const {noteId} = await server.post('search/' + encodeURIComponent($searchInput.val()));

    resetSearch();

    await treeService.reload();

    await treeService.activateNote(noteId);
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
});

$doSearchButton.click(() => doSearch()); // keep long form because of argument
$resetSearchButton.click(resetSearch);

$saveSearchButton.click(saveSearch);

$closeSearchButton.click(hideSearch);

export default {
    toggleSearch,
    resetSearch,
    showSearch,
    doSearch
};