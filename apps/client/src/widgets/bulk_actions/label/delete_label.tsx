import { useEffect, useState } from "preact/hooks";
import { t } from "../../../services/i18n.js";
import FormTextBox from "../../react/FormTextBox.jsx";
import AbstractBulkAction, { ActionDefinition } from "../abstract_bulk_action.js";
import { useSpacedUpdate } from "../../react/hooks.jsx";
import BulkAction from "../BulkAction.jsx";

function DeleteLabelBulkActionComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition}) {
    const [ labelName, setLabelName ] = useState<string>(actionDef.labelName ?? "");
    const spacedUpdate = useSpacedUpdate(() => bulkAction.saveAction({ labelName }));
    useEffect(() => spacedUpdate.scheduleUpdate(), [labelName]);

    return (
        <BulkAction
            bulkAction={bulkAction}
            label={t("delete_label.delete_label")}
        >
            <FormTextBox
                pattern="[\\p{L}\\p{N}_:]+"
                title={t("delete_label.label_name_title")}
                placeholder={t("delete_label.label_name_placeholder")}
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

    doRender() {
        return <DeleteLabelBulkActionComponent bulkAction={this} actionDef={this.actionDef} />
    }
}
