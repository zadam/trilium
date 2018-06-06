import treeService from '../services/tree.js';
import linkService from '../services/link.js';
import server from '../services/server.js';

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
        source: async function(request, response) {
            const result = await server.get('autocomplete?query=' + encodeURIComponent(request.term));

            response(result);
        },
        minLength: 2
    });

    $autoComplete.autocomplete("instance")._renderItem = function(ul, item) {
        return $("<li>")
            .append("<div>" + item.label + "</div>")
            .appendTo(ul);
    };
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