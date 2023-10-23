import noteAutocompleteService from '../../services/note_autocomplete.js';
import utils from "../../services/utils.js";
import appContext from "../../components/app_context.js";
import BasicWidget from "../basic_widget.js";
import shortcutService from "../../services/shortcuts.js";

const TPL = `<div class="jump-to-note-dialog modal mx-auto" tabindex="-1" role="dialog">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <div class="input-group">
                    <input class="jump-to-note-autocomplete form-control" placeholder="search for note by its name">
                </div>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <div class="algolia-autocomplete-container jump-to-note-results"></div>
            </div>
            <div class="modal-footer">
                <button class="show-in-full-text-button btn btn-sm">Search in full text <kbd>Ctrl+Enter</kbd></button>
            </div>
        </div>
    </div>
</div>`;

const KEEP_LAST_SEARCH_FOR_X_SECONDS = 120;

export default class JumpToNoteDialog extends BasicWidget {
    constructor() {
        super();

        this.lastOpenedTs = 0;
    }

    doRender() {
        this.$widget = $(TPL);
        this.$autoComplete = this.$widget.find(".jump-to-note-autocomplete");
        this.$results = this.$widget.find(".jump-to-note-results");
        this.$showInFullTextButton = this.$widget.find(".show-in-full-text-button");
        this.$showInFullTextButton.on('click', e => this.showInFullText(e));

        shortcutService.bindElShortcut(this.$widget, 'ctrl+return', e => this.showInFullText(e));
    }

    async jumpToNoteEvent() {
        utils.openDialog(this.$widget);

        // first open dialog, then refresh since refresh is doing focus which should be visible
        this.refresh();

        this.lastOpenedTs = Date.now();
    }

    async refresh() {
        noteAutocompleteService.initNoteAutocomplete(this.$autoComplete, {
            allowCreatingNotes: true,
            hideGoToSelectedNoteButton: true,
            container: this.$results
        })
            // clear any event listener added in previous invocation of this function
            .off('autocomplete:noteselected')
            .on('autocomplete:noteselected', function (event, suggestion, dataset) {
                if (!suggestion.notePath) {
                    return false;
                }

                appContext.tabManager.getActiveContext().setNote(suggestion.notePath);
            });

        // if you open the Jump To dialog soon after using it previously, it can often mean that you
        // actually want to search for the same thing (e.g., you opened the wrong note at first try)
        // so we'll keep the content.
        // if it's outside of this time limit, then we assume it's a completely new search and show recent notes instead.
        if (Date.now() - this.lastOpenedTs > KEEP_LAST_SEARCH_FOR_X_SECONDS * 1000) {
            noteAutocompleteService.showRecentNotes(this.$autoComplete);
        } else {
            this.$autoComplete
                // hack, the actual search value is stored in <pre> element next to the search input
                // this is important because the search input value is replaced with the suggestion note's title
                .autocomplete("val", this.$autoComplete.next().text())
                .trigger('focus')
                .trigger('select');
        }
    }

    showInFullText(e) {
        // stop from propagating upwards (dangerous, especially with ctrl+enter executable javascript notes)
        e.preventDefault();
        e.stopPropagation();

        const searchString = this.$autoComplete.val();

        this.triggerCommand('searchNotes', {searchString});

        this.$widget.modal('hide');
    }
}
