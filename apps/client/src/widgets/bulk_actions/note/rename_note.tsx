import AbstractBulkAction, { ActionDefinition } from "../abstract_bulk_action.js";
import { t } from "../../../services/i18n.js";
import BulkAction from "../BulkAction.jsx";
import FormTextBox from "../../react/FormTextBox.jsx";
import { useEffect, useState } from "preact/hooks";
import { useSpacedUpdate } from "../../react/hooks.jsx";

function RenameNoteBulkActionComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition}) {
    const [ newTitle, setNewTitle ] = useState<string>(actionDef.newTitle ?? "");
    const spacedUpdate = useSpacedUpdate(() => bulkAction.saveAction({ newTitle }));
    useEffect(() => spacedUpdate.scheduleUpdate(), [ newTitle ]);

    return (
        <BulkAction
            bulkAction={bulkAction}
            label={t("rename_note.rename_note_title_to")}
        >
            <FormTextBox
                placeholder={t("rename_note.new_note_title")}
                title={t("rename_note.description")}
                currentValue={newTitle} onChange={setNewTitle}
            />
        </BulkAction>
    )
}

export default class RenameNoteBulkAction extends AbstractBulkAction {
    static get actionName() {
        return "renameNote";
    }

    static get actionTitle() {
        return t("rename_note.rename_note");
    }
    static get actionIcon() {
        return "bx bx-note bulk-action-marker-rename";
    }
    static get actionDescription() {
        return t("rename_note.description");
    }

    doRender() {
        return <RenameNoteBulkActionComponent bulkAction={this} actionDef={this.actionDef} />
    }

}
