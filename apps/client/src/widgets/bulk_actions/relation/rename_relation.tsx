import AbstractBulkAction, { ActionDefinition } from "../abstract_bulk_action.js";
import { t } from "../../../services/i18n.js";
import BulkAction, { BulkActionText } from "../BulkAction.jsx";
import FormTextBox from "../../react/FormTextBox.jsx";
import { useEffect, useState } from "preact/hooks";
import { useSpacedUpdate } from "../../react/hooks.jsx";

function RenameRelationBulkActionComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition }) {
    const [ oldRelationName, setOldRelationName ] = useState(actionDef.oldRelationName);
    const [ newRelationName, setNewRelationName ] = useState(actionDef.newRelationName);
    const spacedUpdate = useSpacedUpdate(() => bulkAction.saveAction({ oldRelationName, newRelationName }));
    useEffect(() => spacedUpdate.scheduleUpdate(), [ oldRelationName, newRelationName ]);

    return (
        <BulkAction
            bulkAction={bulkAction}
            label={t("rename_relation.rename_relation_from")}
        >
            <FormTextBox
                placeholder={t("rename_relation.old_name")}
                pattern="[\\p{L}\\p{N}_:]+"
                title={t("rename_relation.allowed_characters")}
                currentValue={oldRelationName} onChange={setOldRelationName}
            />

            <BulkActionText text={t("rename_relation.to")} />

            <FormTextBox
                placeholder={t("rename_relation.new_name")}
                pattern="[\\p{L}\\p{N}_:]+"
                title={t("rename_relation.allowed_characters")}
                currentValue={newRelationName} onChange={setNewRelationName}
            />
        </BulkAction>
    )
}

export default class RenameRelationBulkAction extends AbstractBulkAction {
    static get actionName() {
        return "renameRelation";
    }
    static get actionTitle() {
        return t("rename_relation.rename_relation");
    }
    static get actionIcon() {
        return "bx bx-transfer bulk-action-marker-rename";
    }

    doRender() {
        return <RenameRelationBulkActionComponent bulkAction={this} actionDef={this.actionDef} />
    }
}
