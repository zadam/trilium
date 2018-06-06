import treeService from '../services/tree.js';
import linkService from '../services/link.js';
import server from '../services/server.js';
import searchNotesService from '../services/search_notes.js';

const $dialog = $("#jump-to-note-dialog");
const $autoComplete = $("#jump-to-note-autocomplete");
const $form = $("#jump-to-note-form");
const $jumpToNoteButton = $("#jump-to-note-button");
const $showInFullTextButton = $("#show-in-full-text-button");

async function showDialog() {
    glob.activeDialog = $dialog;

    $autoComplete.val('');

    $dialog.dialog({
        modal: true,
        width: 800
    });

    await $autoComplete.autocomplete({
        source: async function(request, response) {
            const result = await server.get('autocomplete?query=' + encodeURIComponent(request.term));

            response(result);
        },
        minLength: 2
    });
}

function getSelectedNotePath() {
    const val = $autoComplete.val();
    return linkService.getNodePathFromLabel(val);
}

function goToNote() {
    const notePath = getSelectedNotePath();

    if (notePath) {
        treeService.activateNode(notePath);

        $dialog.dialog('close');
    }
}

function showInFullText(e) {
    // stop from propagating upwards (dangerous especially with ctrl+enter executable javascript notes)
    e.preventDefault();
    e.stopPropagation();

    const searchText = $autoComplete.val();

    searchNotesService.resetSearch();
    searchNotesService.showSearch();
    searchNotesService.doSearch(searchText);

    $dialog.dialog('close');
}

$form.submit(() => {
    goToNote();

    return false;
});

$jumpToNoteButton.click(goToNote);

$showInFullTextButton.click(showInFullText);

$dialog.bind('keydown', 'ctrl+return', showInFullText);

export default {
    showDialog
};