import { useEffect, useState } from "preact/hooks";
import { t } from "../../../services/i18n";
import FormTextBox from "../../react/FormTextBox";
import AbstractBulkAction, { ActionDefinition } from "../abstract_bulk_action";
import BulkAction, { BulkActionArrow } from "../BulkAction";
import { useSpacedUpdate } from "../../react/hooks";

function AddLabelBulkActionComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition }) {
    const [ labelName, setLabelName ] = useState<string>(actionDef.labelName ?? "");
    const [ labelValue, setLabelValue ] = useState<string>(actionDef.labelValue ?? "");
    const spacedUpdate = useSpacedUpdate(() => bulkAction.saveAction({ labelName, labelValue }));
    useEffect(() => spacedUpdate.scheduleUpdate(), [labelName, labelValue]);

    return (
        <BulkAction
            bulkAction={bulkAction}
        >
            <FormTextBox
                placeholder={t("add_label.label_name_placeholder")}
                pattern="[\\p{L}\\p{N}_:]+"
                title={t("add_label.label_name_title")}
                currentValue={labelName} onChange={setLabelName}
            />
            <BulkActionArrow />
            <FormTextBox
                placeholder={t("add_label.new_value_placeholder")}
                currentValue={labelValue} onChange={setLabelValue}
            />
        </BulkAction>
    )
}

export default class AddLabelBulkAction extends AbstractBulkAction {

    doRender() {
        return <AddLabelBulkActionComponent bulkAction={this} actionDef={this.actionDef} />;
    }

    static get actionName() {
        return "addLabel";
    }

    static get actionTitle() {
        return t("add_label.add_label");
    }
    static get actionIcon() {
        return "bx bx-hash bulk-action-marker-add";
    }
    static get actionDescription() {
        return t("add_label.description");
    }
}
