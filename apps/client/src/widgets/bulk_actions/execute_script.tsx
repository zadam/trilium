import { useState } from "preact/hooks";
import { t } from "../../services/i18n.js";
import FormTextBox from "../react/FormTextBox.jsx";
import AbstractBulkAction, { ActionDefinition } from "./abstract_bulk_action.js";
import BulkAction, { useSaveAction } from "./BulkAction.jsx";

function ExecuteScriptBulkActionComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition }) {
    const [ script, setScript ] = useState(actionDef.script);
    useSaveAction(bulkAction, { script });

    return (
        <BulkAction
            bulkAction={bulkAction}
        >
            <FormTextBox
                placeholder="note.title = note.title + '- suffix';"
                required
                currentValue={script} onChange={setScript}
            />
        </BulkAction>
    );
}

export default class ExecuteScriptBulkAction extends AbstractBulkAction {

    static get actionName() {
        return "executeScript";
    }
    static get actionTitle() {
        return t("execute_script.execute_script");
    }
    static get actionIcon() {
        return "bx bx-play";
    }
    static get actionDescription() {
        return t("execute_script.description");
    }

    doRender() {
        return <ExecuteScriptBulkActionComponent bulkAction={this} actionDef={this.actionDef} />
    }

}
