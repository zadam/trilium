import { useState } from "preact/hooks";
import { t } from "../../../services/i18n.js";
import FormTextBox from "../../react/FormTextBox.jsx";
import AbstractBulkAction, { ActionDefinition } from "../abstract_bulk_action.js";
import BulkAction, { useSaveAction } from "../BulkAction.jsx";

function DeleteLabelBulkActionComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition}) {
    const [ labelName, setLabelName ] = useState<string>(actionDef.labelName ?? "");
    useSaveAction(bulkAction, { labelName });

    return (
        <BulkAction
            bulkAction={bulkAction}
        >
            <FormTextBox
                pattern="[\\p{L}\\p{N}_:]+"
                title={t("delete_label.label_name_title")}
                placeholder={t("delete_label.label_name_placeholder")}
                className="bulk-action-name" required
                currentValue={labelName} onChange={setLabelName}
            />
        </BulkAction>
    );
}

export default class DeleteLabelBulkAction extends AbstractBulkAction {
    static get actionName() {
        return "deleteLabel";
    }
    static get actionTitle() {
        return t("delete_label.delete_label");
    }
    static get actionIcon() {
        return "bx bx-hash bulk-action-marker-delete";
    }
    static get actionDescription() {
        return t("delete_label.description");
    }

    doRender() {
        return <DeleteLabelBulkActionComponent bulkAction={this} actionDef={this.actionDef} />
    }
}
