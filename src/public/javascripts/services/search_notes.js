import treeService from './tree.js';
import treeCache from "./tree_cache.js";
import server from './server.js';
import infoService from "./info.js";

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
    $searchBox.slideDown();
    $searchInput.focus();
}

function hideSearch() {
    resetSearch();

    $searchResults.hide();
    $searchBox.slideUp();
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

    // have at least some feedback which is good especially in situations
    // when the result list does not change with a query
    infoService.showMessage("Search finished successfully.");
}

async function saveSearch() {
    const searchString = $searchInput.val().trim();

    if (searchString.length === 0) {
        alert("Write some search criteria first so there is something to save.");
        return;
    }

    let activeNode = treeService.getActiveNode();
    const parentNote = await treeCache.getNote(activeNode.data.noteId);

    if (parentNote.type === 'search') {
        activeNode = activeNode.getParent();
    }

    await treeService.createNote(activeNode, activeNode.data.noteId, 'into', {
        type: "search",
        mime: "application/json",
        title: searchString,
        content: JSON.stringify({ searchString: searchString })
    });

    resetSearch();
}

function init() {
    const hashValue = treeService.getHashValueFromAddress();

    if (hashValue.startsWith("search=")) {
        showSearch();
        doSearch(hashValue.substr(7));
    }
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
    doSearch,
    init
};