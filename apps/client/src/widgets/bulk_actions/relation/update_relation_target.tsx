import AbstractBulkAction, { ActionDefinition } from "../abstract_bulk_action.js";
import { t } from "../../../services/i18n.js";
import BulkAction, { BulkActionText } from "../BulkAction.jsx";
import FormTextBox from "../../react/FormTextBox.jsx";
import NoteAutocomplete from "../../react/NoteAutocomplete.jsx";
import { useEffect, useState } from "preact/hooks";
import { useSpacedUpdate } from "../../react/hooks.jsx";

function UpdateRelationTargetComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition }) {
    const [ relationName, setRelationName ] = useState(actionDef.relationName);
    const [ targetNoteId, setTargetNoteId ] = useState(actionDef.targetNoteId);
    const spacedUpdate = useSpacedUpdate(() => bulkAction.saveAction({ relationName, targetNoteId }));
    useEffect(() => spacedUpdate.scheduleUpdate(), [ relationName, targetNoteId ]);

    return (
        <BulkAction
            bulkAction={bulkAction}
            label={t("update_relation_target.update_relation")}
            helpText={<>
                <p>{t("update_relation_target.on_all_matched_notes")}:</p>

                <ul style="margin-bottom: 0;">
                    <li>{t("update_relation_target.change_target_note")}</li>
                </ul>
            </>}
        >
            <FormTextBox
                placeholder={t("update_relation_target.relation_name")}
                pattern="[\\p{L}\\p{N}_:]+"
                style={{ flexShrink: 3 }}
                title={t("update_relation_target.allowed_characters")}
                currentValue={relationName} onChange={setRelationName}
            />

            <BulkActionText text={t("update_relation_target.to")} />

            <NoteAutocomplete
                placeholder={t("update_relation_target.target_note")}
                containerStyle={{ flexShrink: 2 }}
                noteId={targetNoteId} noteIdChanged={setTargetNoteId}
            />
        </BulkAction>
    )
}

export default class UpdateRelationTargetBulkAction extends AbstractBulkAction {

    static get actionName() {
        return "updateRelationTarget";
    }

    static get actionTitle() {
        return t("update_relation_target.update_relation_target");
    }
    static get actionIcon() {
        return "bx bx-transfer bulk-action-marker-update";
    }

    doRender() {
        return <UpdateRelationTargetComponent bulkAction={this} actionDef={this.actionDef} />
    }

}
