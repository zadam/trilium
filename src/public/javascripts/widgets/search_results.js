import BasicWidget from "./basic_widget.js";
import toastService from "../services/toast.js";
import server from "../services/server.js";

const TPL = `
<div class="search-results">
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
    
    .search-results-list {
        padding: 5px 5px 5px 15px;
    }
    </style>

    <strong>Search results:</strong>

    <ul class="search-results-list"></ul>
</div>
`;

export default class SearchResultsWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$searchResults = this.$widget;
        this.$searchResultsInner = this.$widget.find(".search-results-list");

        this.toggleInt(false);

        return this.$widget;
    }

    searchResultsEvent({results}) {
        this.toggleInt(true);

        this.$searchResultsInner.empty();
        this.$searchResults.show();

        for (const result of results) {
            const link = $('<a>', {
                href: 'javascript:',
                text: result.title
            }).attr('data-action', 'note').attr('data-note-path', result.path);

            const $result = $('<li>').append(link);

            this.$searchResultsInner.append($result);
        }
    }

    searchFlowEndedEvent() {
        this.$searchResults.hide();
    }
}