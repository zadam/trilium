import treeService from '../services/tree.js';
import searchNotesService from '../services/search_notes.js';
import noteautocompleteService from '../services/note_autocomplete.js';
import linkService from "../services/link.js";

const $dialog = $("#jump-to-note-dialog");
const $autoComplete = $("#jump-to-note-autocomplete");
const $showInFullTextButton = $("#show-in-full-text-button");
const $showRecentNotesButton = $dialog.find(".show-recent-notes-button");

$dialog.on("shown.bs.modal", e => $autoComplete.focus());

async function showDialog() {
    glob.activeDialog = $dialog;

    $autoComplete.val('');

    $dialog.modal();

    $autoComplete.autocomplete({
        appendTo: document.querySelector('body'),
        hint: false,
        autoselect: true,
        openOnFocus: true,
        minLength: 0
    }, [
        {
            source: noteautocompleteService.autocompleteSource,
            displayKey: 'title',
            templates: {
                suggestion: function(suggestion) {
                    return suggestion.title;
                }
            }
        }
    ]).on('autocomplete:selected', function(event, suggestion, dataset) {
        if (!suggestion.path) {
            return false;
        }

        treeService.activateNote(suggestion.path);

        $dialog.modal('hide');
    });

    showRecentNotes();
}

function showInFullText(e) {
    // stop from propagating upwards (dangerous especially with ctrl+enter executable javascript notes)
    e.preventDefault();
    e.stopPropagation();

    const searchText = $autoComplete.val();

    searchNotesService.resetSearch();
    searchNotesService.showSearch();
    searchNotesService.doSearch(searchText);

    $dialog.modal('hide');
}

function showRecentNotes() {
    $autoComplete.autocomplete("val", "");
    $autoComplete.autocomplete("open");
}

$showInFullTextButton.click(showInFullText);

$showRecentNotesButton.click(showRecentNotes);

$dialog.bind('keydown', 'ctrl+return', showInFullText);

export default {
    showDialog
};