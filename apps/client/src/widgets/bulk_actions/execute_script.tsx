import { useEffect, useState } from "preact/hooks";
import { t } from "../../services/i18n.js";
import FormTextBox from "../react/FormTextBox.jsx";
import AbstractBulkAction, { ActionDefinition } from "./abstract_bulk_action.js";
import BulkAction from "./BulkAction.jsx";
import { useSpacedUpdate } from "../react/hooks.jsx";

function ExecuteScriptBulkActionComponent({ bulkAction, actionDef }: { bulkAction: AbstractBulkAction, actionDef: ActionDefinition }) {
    const [ script, setScript ] = useState(actionDef.script);
    const spacedUpdate = useSpacedUpdate(() => bulkAction.saveAction({ script }));
    useEffect(() => spacedUpdate.scheduleUpdate(), [ script ]);

    return (
        <BulkAction
            bulkAction={bulkAction}
            label={t("execute_script.execute_script")}
            helpText={<>
                {t("execute_script.help_text")}

                {t("execute_script.example_1")}

                <pre>note.title = note.title + ' - suffix';</pre>

                {t("execute_script.example_2")}

                <pre>{"for (const attr of note.getOwnedAttributes) { attr.markAsDeleted(); }"}</pre>
            </>}
        >
            <FormTextBox
                placeholder="note.title = note.title + '- suffix';"
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

    doRender() {
        return <ExecuteScriptBulkActionComponent bulkAction={this} actionDef={this.actionDef} />
    }

}
