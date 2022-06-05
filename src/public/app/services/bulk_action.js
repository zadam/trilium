import server from "./server.js";
import ws from "./ws.js";
import MoveNoteBulkAction from "../widgets/bulk_actions/move_note.js";
import DeleteNoteBulkAction from "../widgets/bulk_actions/delete_note.js";
import DeleteNoteRevisionsBulkAction from "../widgets/bulk_actions/delete_note_revisions.js";
import DeleteLabelBulkAction from "../widgets/bulk_actions/delete_label.js";
import DeleteRelationBulkAction from "../widgets/bulk_actions/delete_relation.js";
import RenameLabelBulkAction from "../widgets/bulk_actions/rename_label.js";
import RenameRelationBulkAction from "../widgets/bulk_actions/rename_relation.js";
import SetLabelValueBulkAction from "../widgets/bulk_actions/set_label_value.js";
import SetRelationTargetSearchAction from "../widgets/bulk_actions/set_relation_target.js";
import ExecuteScriptBulkAction from "../widgets/bulk_actions/execute_script.js";

const ACTION_CLASSES = [
    MoveNoteBulkAction,
    DeleteNoteBulkAction,
    DeleteNoteRevisionsBulkAction,
    DeleteLabelBulkAction,
    DeleteRelationBulkAction,
    RenameLabelBulkAction,
    RenameRelationBulkAction,
    SetLabelValueBulkAction,
    SetRelationTargetSearchAction,
    ExecuteScriptBulkAction
];

async function addAction(noteId, actionName) {
    await server.post(`notes/${noteId}/attributes`, {
        type: 'label',
        name: 'action',
        value: JSON.stringify({
            name: actionName
        })
    });

    await ws.waitForMaxKnownEntityChangeId();
}

function parseActions(note) {
    const actionLabels = note.getLabels('action');

    return actionLabels.map(actionAttr => {
        let actionDef;

        try {
            actionDef = JSON.parse(actionAttr.value);
        } catch (e) {
            logError(`Parsing of attribute: '${actionAttr.value}' failed with error: ${e.message}`);
            return null;
        }

        const ActionClass = ACTION_CLASSES.find(actionClass => actionClass.actionName === actionDef.name);

        if (!ActionClass) {
            logError(`No action class for '${actionDef.name}' found.`);
            return null;
        }

        return new ActionClass(actionAttr, actionDef);
    })
        .filter(action => !!action);
}

export default {
    addAction,
    parseActions,
    ACTION_CLASSES
};
