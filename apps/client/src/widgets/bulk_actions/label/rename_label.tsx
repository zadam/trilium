import { useEffect, useState } from "preact/hooks";
import { t } from "../../../services/i18n.js";
import FormTextBox from "../../react/FormTextBox.jsx";
import AbstractBulkAction, { ActionDefinition } from "../abstract_bulk_action.js";
import BulkAction, { BulkActionArrow } from "../BulkAction.jsx";
import { useSpacedUpdate } from "../../react/hooks.jsx";

function RenameLabelBulkActionComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition}) {
    const [ oldLabelName, setOldLabelName ] = useState(actionDef.oldLabelName);
    const [ newLabelName, setNewLabelName ] = useState(actionDef.newLabelName);
    const spacedUpdate = useSpacedUpdate(() => bulkAction.saveAction({ oldLabelName, newLabelName }));
    useEffect(() => spacedUpdate.scheduleUpdate(), [ oldLabelName, newLabelName ]);

    return (
        <BulkAction
            bulkAction={bulkAction}
        >
            <FormTextBox
                placeholder={t("rename_label.old_name_placeholder")}
                pattern="[\\p{L}\\p{N}_:]+"
                title={t("rename_label.name_title")}
                className="bulk-action-name" required
                currentValue={oldLabelName} onChange={setOldLabelName}
            />

            <BulkActionArrow />

            <FormTextBox
                placeholder={t("rename_label.new_name_placeholder")}
                pattern="[\\p{L}\\p{N}_:]+"
                title={t("rename_label.name_title")}
                className="bulk-action-name" required
                currentValue={newLabelName} onChange={setNewLabelName}
            />
        </BulkAction>
    )
}

export default class RenameLabelBulkAction extends AbstractBulkAction {
    static get actionName() {
        return "renameLabel";
    }
    static get actionTitle() {
        return t("rename_label.rename_label");
    }
    static get actionIcon() {
        return "bx bx-hash bulk-action-marker-rename";
    }
    static get actionDescription() {
        return t("rename_label.description");
    }

    doRender() {
        return <RenameLabelBulkActionComponent bulkAction={this} actionDef={this.actionDef} />
    }
}
