"use strict";

import treeService from '../note_tree.js';
import link from '../link.js';
import utils from '../utils.js';

const $showDialogButton = $("#jump-to-note-button");
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
    return link.getNodePathFromLabel(val);
}

function goToNote() {
    const notePath = getSelectedNotePath();

    if (notePath) {
        treeService.activateNode(notePath);

        $dialog.dialog('close');
    }
}

$(document).bind('keydown', 'ctrl+j', e => {
    showDialog();

    e.preventDefault();
});

$form.submit(() => {
    const action = $dialog.find("button:focus").val();

    goToNote();

    return false;
});

$showDialogButton.click(showDialog);

export default {
    showDialog
};