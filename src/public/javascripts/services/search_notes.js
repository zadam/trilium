import toastService from "./toast.js";
import appContext from "./app_context.js";

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

async function refreshSearch() {
    const activeNode = appContext.getMainNoteTree().getActiveNode();

    activeNode.load(true);
    activeNode.setExpanded(true);

    toastService.showMessage("Saved search note refreshed.");
}

function init() {
    const hashValue = document.location.hash ? document.location.hash.substr(1) : ""; // strip initial #

    if (hashValue.startsWith("search=")) {
        showSearch();
        doSearch(hashValue.substr(7));
    }
}

export default {
    refreshSearch,
    init,
    getHelpText: () => helpText
};