import noteAutocompleteService from '../services/note_autocomplete.js';
import utils from "../services/utils.js";
import appContext from "../services/app_context.js";

const $dialog = $("#jump-to-note-dialog");
const $autoComplete = $("#jump-to-note-autocomplete");
const $showInFullTextButton = $("#show-in-full-text-button");

let lastOpenedTs = 0;
const KEEP_LAST_SEARCH_FOR_X_SECONDS = 120;

export async function showDialog() {
    utils.openDialog($dialog);

    noteAutocompleteService.initNoteAutocomplete($autoComplete, { hideGoToSelectedNoteButton: true })
        // clear any event listener added in previous invocation of this function
        .off('autocomplete:noteselected')
        .on('autocomplete:noteselected', function(event, suggestion, dataset) {
            if (!suggestion.notePath) {
                return false;
            }

            appContext.tabManager.getActiveTabContext().setNote(suggestion.notePath);
        });

    // if you open the Jump To dialog soon after using it previously it can often mean that you
    // actually want to search for the same thing (e.g. you opened the wrong note at first try)
    // so we'll keep the content.
    // if it's outside of this time limit then we assume it's a completely new search and show recent notes instead.
    if (Date.now() - lastOpenedTs > KEEP_LAST_SEARCH_FOR_X_SECONDS * 1000) {
        noteAutocompleteService.showRecentNotes($autoComplete);
    }
    else {
        $autoComplete
            // hack, the actual search value is stored in <pre> element next to the search input
            // this is important because the search input value is replaced with the suggestion note's title
            .autocomplete("val", $autoComplete.next().text())
            .trigger('focus')
            .trigger('select');
    }

    lastOpenedTs = Date.now();
}

function showInFullText(e) {
    // stop from propagating upwards (dangerous especially with ctrl+enter executable javascript notes)
    e.preventDefault();
    e.stopPropagation();

    const searchText = $autoComplete.val();

    appContext.triggerCommand('showSearch', {searchText});
    appContext.triggerCommand('searchForResults', {searchText});

    $dialog.modal('hide');
}


$showInFullTextButton.on('click', showInFullText);

utils.bindElShortcut($dialog, 'ctrl+return', showInFullText);
