import treeService from './tree.js';
import treeCache from "./tree_cache.js";
import server from './server.js';
import toastService from "./toast.js";

const $searchInput = $("input[name='search-text']");
const $resetSearchButton = $("#reset-search-button");
const $doSearchButton = $("#do-search-button");
const $saveSearchButton = $("#save-search-button");
const $searchBox = $("#search-box");
const $searchResults = $("#search-results");
const $searchResultsInner = $("#search-results-inner");
const $closeSearchButton = $("#close-search-button");

const helpText = `
<strong>Search tips</strong> - also see <button class="btn btn-sm" type="button" data-help-page="Search">complete help on search</button>
<p>
<ul>
    <li>Just enter any text for full text search</li>
    <li><code>@abc</code> - returns notes with label abc</li>
    <li><code>@year=2019</code> - matches notes with label <code>year</code> having value <code>2019</code></li>
    <li><code>@rock @pop</code> - matches notes which have both <code>rock</code> and <code>pop</code> labels</li>
    <li><code>@rock or @pop</code> - only one of the labels must be present</li>
    <li><code>@year&lt;=2000</code> - numerical comparison (also &gt;, &gt;=, &lt;).</li>
    <li><code>@dateCreated>=MONTH-1</code> - notes created in the last month</li>
    <li><code>=handler</code> - will execute script defined in <code>handler</code> relation to get results</li>
</ul>
</p>`;

function showSearch() {
    $searchBox.slideDown();

    $searchBox.tooltip({
        trigger: 'focus',
        html: true,
        title: helpText,
        placement: 'right',
        delay: {
            show: 500, // necessary because sliding out may cause wrong position
            hide: 200
        }
    });

    $searchInput.trigger('focus');
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

async function doSearch(searchText) {
    if (searchText) {
        $searchInput.val(searchText);
    }
    else {
        searchText = $searchInput.val();
    }

    if (searchText.trim().length === 0) {
        toastService.showMessage("Please enter search criteria first.");

        $searchInput.trigger('focus');

        return;
    }

    $searchBox.tooltip("hide");

    const response = await server.get('search/' + encodeURIComponent(searchText));

    if (!response.success) {
        toastService.showError("Search failed.", 3000);
        return;
    }

    $searchResultsInner.empty();
    $searchResults.show();

    for (const result of response.results) {
        const link = $('<a>', {
            href: 'javascript:',
            text: result.title
        }).attr('data-action', 'note').attr('data-note-path', result.path);

        const $result = $('<li>').append(link);

        $searchResultsInner.append($result);
    }

    // have at least some feedback which is good especially in situations
    // when the result list does not change with a query
    toastService.showMessage("Search finished successfully.");
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

async function refreshSearch() {
    const activeNode = treeService.getActiveNode();

    activeNode.load(true);
    activeNode.setExpanded(true);

    toastService.showMessage("Saved search note refreshed.");
}

function searchInSubtree(noteId) {
    showSearch();

    $searchInput.val(`@in=${noteId} @text*=*`);
}

function init() {
    const hashValue = document.location.hash ? document.location.hash.substr(1) : ""; // strip initial #

    if (hashValue.startsWith("search=")) {
        showSearch();
        doSearch(hashValue.substr(7));
    }
}

$searchInput.on('keyup',e => {
    const searchText = $searchInput.val();

    if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(searchText) === "") {
        $resetSearchButton.trigger('click');
        return;
    }

    if (e && e.which === $.ui.keyCode.ENTER) {
        doSearch();
    }
});

$doSearchButton.on('click', () => doSearch()); // keep long form because of argument
$resetSearchButton.on('click', resetSearch);

$saveSearchButton.on('click', saveSearch);

$closeSearchButton.on('click', hideSearch);

export default {
    toggleSearch,
    resetSearch,
    showSearch,
    refreshSearch,
    doSearch,
    init,
    searchInSubtree,
    getHelpText: () => helpText
};