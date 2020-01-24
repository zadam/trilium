import BasicWidget from "./basic_widget.js";
import treeService from "../services/tree.js";
import treeCache from "../services/tree_cache.js";
import toastService from "../services/toast.js";
import appContext from "../services/app_context.js";

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

const TPL = `
<div class="search-box">
    <style>
    .search-box {
        display: none;
        padding: 10px;
        margin-top: 10px;
    }
    
    .search-text {
        border: 1px solid var(--main-border-color);
    }
    </style>

    <div class="form-group">
        <div class="input-group">
            <input name="search-text" class="search-text form-control"
                   placeholder="Search text, labels" autocomplete="off">

            <div class="input-group-append">
                <button class="do-search-button btn btn-sm icon-button bx bx-search" title="Search (enter)"></button>
            </div>
        </div>
    </div>

    <div style="display: flex; align-items: center; justify-content: space-evenly; flex-wrap: wrap;">
        <button class="save-search-button btn btn-sm"
            title="This will create new saved search note under active note.">
            <span class="bx bx-save"></span> Save search
        </button>

        <button class="close-search-button btn btn-sm">
            <span class="bx bx-x"></span> Close search
        </button>
    </div>
</div>`;

export default class SearchBoxWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$searchBox = this.$widget;
        this.$closeSearchButton = this.$widget.find(".close-search-button");
        this.$searchInput = this.$widget.find("input[name='search-text']");
        this.$resetSearchButton = this.$widget.find(".reset-search-button");
        this.$doSearchButton = this.$widget.find(".do-search-button");
        this.$saveSearchButton = this.$widget.find(".save-search-button");

        this.$searchInput.on('keyup',e => {
            const searchText = this.$searchInput.val();

            if (e && e.which === $.ui.keyCode.ESCAPE || $.trim(searchText) === "") {
                this.$resetSearchButton.trigger('click');
                return;
            }

            if (e && e.which === $.ui.keyCode.ENTER) {
                this.doSearch();
            }
        });

        this.$doSearchButton.on('click', () => this.doSearch()); // keep long form because of argument
        this.$resetSearchButton.on('click', () => this.resetSearchListener());

        this.$saveSearchButton.on('click', () => this.saveSearch());

        this.$closeSearchButton.on('click', () => this.trigger('hideSearch'));

        return this.$widget;
    }

    doSearch(searchText) {
        if (searchText) {
            this.$searchInput.val(searchText);
        }
        else {
            searchText = this.$searchInput.val();
        }

        if (searchText.trim().length === 0) {
            toastService.showMessage("Please enter search criteria first.");

            this.$searchInput.trigger('focus');

            return;
        }

        this.trigger('searchForResults', {
            searchText: this.$searchInput.val()
        });

        this.$searchBox.tooltip("hide");
    }

    async saveSearch() {
        const searchString = this.$searchInput.val().trim();

        if (searchString.length === 0) {
            alert("Write some search criteria first so there is something to save.");
            return;
        }

        let activeNode = appContext.getMainNoteTree().getActiveNode();
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

        this.resetSearchListener();
    }

    showSearchListener() {
        this.$searchBox.slideDown();

        this.$searchBox.tooltip({
            trigger: 'focus',
            html: true,
            title: helpText,
            placement: 'right',
            delay: {
                show: 500, // necessary because sliding out may cause wrong position
                hide: 200
            }
        });

        this.$searchInput.trigger('focus');
    }

    hideSearchListener() {
        this.resetSearchListener();

        this.$searchBox.slideUp();

        this.trigger('hideSearchResults');
    }

    toggleSearchListener() {
        if (this.$searchBox.is(":hidden")) {
            this.showSearchListener();
        }
        else {
            this.hideSearchListener();
        }
    }

    searchNotesListener() {
        this.toggleSearchListener();
    }

    resetSearchListener() {
        this.$searchInput.val("");
    }

    searchInSubtreeListener({noteId}) {
        noteId = noteId || appContext.getActiveTabNoteId();

        this.toggle(true);

        this.$searchInput.val(`@in=${noteId} @text*=*`);
    }
}