import AbstractBulkAction, { ActionDefinition } from "../abstract_bulk_action.js";
import { t } from "../../../services/i18n.js";
import BulkAction from "../BulkAction.jsx";
import FormTextBox from "../../react/FormTextBox.jsx";
import { useEffect, useState } from "preact/hooks";
import { useSpacedUpdate } from "../../react/hooks.jsx";

function DeleteRelationBulkActionComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition }) {
    const [ relationName, setRelationName ] = useState(actionDef.relationName);
    const spacedUpdate = useSpacedUpdate(() => bulkAction.saveAction({ relationName }));
    useEffect(() => spacedUpdate.scheduleUpdate(), [ relationName ]);

    return (
        <BulkAction
            bulkAction={bulkAction}
            label={t("delete_relation.delete_relation")}
        >
            <FormTextBox
                pattern="[\\p{L}\\p{N}_:]+"
                placeholder={t("delete_relation.relation_name")}
                title={t("delete_relation.allowed_characters")}
                currentValue={relationName} onChange={setRelationName}
            />
        </BulkAction>
    )
}

export default class DeleteRelationBulkAction extends AbstractBulkAction {

    static get actionName() {
        return "deleteRelation";
    }

    static get actionTitle() {
        return t("delete_relation.delete_relation");
    }
    static get actionIcon() {
        return "bx bx-transfer bulk-action-marker-delete";
    }
    static get actionDescription() {
        return t("delete_relation.description");
    }

    doRender() {
        return <DeleteRelationBulkActionComponent bulkAction={this} actionDef={this.actionDef} />
    }
}
