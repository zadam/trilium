import utils from "../services/utils.js";
import bulkActionService from "../services/bulk_action.js";
import froca from "../services/froca.js";

const $dialog = $("#bulk-assign-attributes-dialog");
const $availableActionList = $("#bulk-available-action-list");
const $existingActionList = $("#bulk-existing-action-list");

$dialog.on('click', '[data-action-add]', async event => {
    const actionName = $(event.target).attr('data-action-add');

    await bulkActionService.addAction('bulkaction', actionName);

    await refresh();
});

for (const actionGroup of bulkActionService.ACTION_GROUPS) {
    const $actionGroupList = $("<td>");
    const $actionGroup = $("<tr>")
        .append($("<td>").text(actionGroup.title + ": "))
        .append($actionGroupList);

    for (const action of actionGroup.actions) {
        $actionGroupList.append(
            $('<button class="btn btn-sm">')
                .attr('data-action-add', action.actionName)
                .text(action.actionTitle)
        );
    }

    $availableActionList.append($actionGroup);
}

async function refresh() {
    const bulkActionNote = await froca.getNote('bulkaction');

    const actions = bulkActionService.parseActions(bulkActionNote);

    $existingActionList
        .empty()
        .append(...actions.map(action => action.render()));
}

export async function showDialog(nodes) {
    await refresh();

    utils.openDialog($dialog);
}
