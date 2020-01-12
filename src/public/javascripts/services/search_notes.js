import treeService from './tree.js';
import treeCache from "./tree_cache.js";
import server from './server.js';
import toastService from "./toast.js";
import appContext from "./app_context.js";

async function refreshSearch() {
    const activeNode = appContext.getMainNoteTree().getActiveNode();

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

export default {
    // toggleSearch,
    // resetSearch,
    // showSearch,
    // doSearch,
    refreshSearch,
    init,
    searchInSubtree,
    getHelpText: () => helpText
};