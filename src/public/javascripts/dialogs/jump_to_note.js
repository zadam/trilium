import treeService from '../services/tree.js';
import linkService from '../services/link.js';
import utils from '../services/utils.js';

const $dialog = $("#jump-to-note-dialog");
const $autoComplete = $("#jump-to-note-autocomplete");
const $form = $("#jump-to-note-form");

async function showDialog() {
    glob.activeDialog = $dialog;

    $autoComplete.val('');

    $dialog.dialog({
        modal: true,
        width: 800
    });

    await $autoComplete.autocomplete({
        source: await utils.stopWatch("building autocomplete", treeService.getAutocompleteItems),
        minLength: 0
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

$form.submit(() => {
    goToNote();

    return false;
});

export default {
    showDialog
};