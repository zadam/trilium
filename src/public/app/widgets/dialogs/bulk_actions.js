import BasicWidget from "../basic_widget.js";
import froca from "../../services/froca.js";
import bulkActionService from "../../services/bulk_action.js";
import utils from "../../services/utils.js";

const TPL = `
<div class="bulk-assign-attributes-dialog modal mx-auto" tabindex="-1" role="dialog">
    <style>
        .bulk-assign-attributes-dialog .modal-body h4:not(:first-child) {
            margin-top: 20px;
        }
    
        .bulk-available-action-list button {
            padding: 2px 7px;
            margin-right: 10px;
            margin-bottom: 5px;
        }
    
        .bulk-existing-action-list {
            width: 100%;
        }
    
        .bulk-existing-action-list td {
            padding: 7px;
        }
    
        .bulk-existing-action-list .button-column {
            /* minimal width so that table remains static sized and most space remains for middle column with settings */
            width: 50px;
            white-space: nowrap;
            text-align: right;
        }
    </style>

    <div class="modal-dialog modal-xl" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title mr-auto">Bulk assign attributes</h5>

                <button type="button" class="close" data-dismiss="modal" aria-label="Close" style="margin-left: 0 !important;">
                    <span aria-hidden="true">&times;</span>
                </button>
            </div>
            <div class="modal-body">
                <h4>Affected notes: <span class="affected-note-count">0</span></h4>

                <div class="form-check">
                    <input class="form-check-input" type="checkbox" value="" class="include-descendants">
                    <label class="form-check-label" for="include-descendants">
                        Include descendant notes
                    </label>
                </div>

                <h4>Available actions</h4>

                <table class="bulk-available-action-list"></table>

                <h4>Chosen actions</h4>

                <table class="bulk-existing-action-list"></table>
            </div>
            <div class="modal-footer">
                <button type="submit" class="btn btn-primary">Execute bulk actions</button>
            </div>
        </div>
    </div>
</div>`;

export default class BulkActionsDialog extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);
        this.$availableActionList = this.$widget.find(".bulk-available-action-list");
        this.$existingActionList = this.$widget.find(".bulk-existing-action-list");

        this.$widget.on('click', '[data-action-add]', async event => {
            const actionName = $(event.target).attr('data-action-add');

            await bulkActionService.addAction('bulkaction', actionName);

            await this.refresh();
        });
    }

    async refresh() {
        this.renderAvailableActions();

        const bulkActionNote = await froca.getNote('bulkaction');

        const actions = bulkActionService.parseActions(bulkActionNote);

        this.$existingActionList.empty();

        if (actions.length > 0) {
            this.$existingActionList.append(...actions.map(action => action.render()));
        } else {
            this.$existingActionList.append($("<p>None yet ... add an action by clicking one of the available ones above.</p>"))
        }
    }

    renderAvailableActions() {
        this.$availableActionList.empty();

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

            this.$availableActionList.append($actionGroup);
        }
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes().find(attr => attr.type === 'label' && attr.name === 'action')) {
            this.refresh();
        }
    }

    async bulkActionsEvent({node}) {
        await this.refresh();

        utils.openDialog(this.$widget);
    }
}
