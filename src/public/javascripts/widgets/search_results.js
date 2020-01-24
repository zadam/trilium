import BasicWidget from "./basic_widget.js";
import toastService from "../services/toast.js";
import server from "../services/server.js";

const TPL = `
<div>
    <style>
    .search-results {
        padding: 0 5px 5px 15px;
        flex-basis: 40%;
        flex-grow: 1;
        flex-shrink: 1;
        margin-top: 10px;
        display: none;
        overflow: auto;
        border-bottom: 2px solid var(--main-border-color);
    }
    
    .search-results ul {
        padding: 5px 5px 5px 15px;
    }
    </style>

    <strong>Search results:</strong>

    <ul class="search-results-inner"></ul>
</div>
`;

export default class SearchResultsWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$searchResults = this.$widget;
        this.$searchResultsInner = this.$widget.find(".search-results-inner");

        this.toggle(false);

        return this.$widget;
    }

    async searchForResultsListener({searchText}) {
        this.toggle(true);

        const response = await server.get('search/' + encodeURIComponent(searchText));

        if (!response.success) {
            toastService.showError("Search failed.", 3000);
            return;
        }

        this.$searchResultsInner.empty();
        this.$searchResults.show();

        for (const result of response.results) {
            const link = $('<a>', {
                href: 'javascript:',
                text: result.title
            }).attr('data-action', 'note').attr('data-note-path', result.path);

            const $result = $('<li>').append(link);

            this.$searchResultsInner.append($result);
        }

        // have at least some feedback which is good especially in situations
        // when the result list does not change with a query
        toastService.showMessage("Search finished successfully.");
    }

    hideSearchResultsListener() {
        this.$searchResults.hide();
    }
}