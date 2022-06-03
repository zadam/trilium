import server from "./server.js";
import ws from "./ws.js";
import MoveNoteSearchAction from "../widgets/search_actions/move_note.js";
import DeleteNoteSearchAction from "../widgets/search_actions/delete_note.js";
import DeleteNoteRevisionsSearchAction from "../widgets/search_actions/delete_note_revisions.js";
import DeleteLabelSearchAction from "../widgets/search_actions/delete_label.js";
import DeleteRelationSearchAction from "../widgets/search_actions/delete_relation.js";
import RenameLabelSearchAction from "../widgets/search_actions/rename_label.js";
import RenameRelationSearchAction from "../widgets/search_actions/rename_relation.js";
import SetLabelValueSearchAction from "../widgets/search_actions/set_label_value.js";
import SetRelationTargetSearchAction from "../widgets/search_actions/set_relation_target.js";
import ExecuteScriptSearchAction from "../widgets/search_actions/execute_script.js";

const ACTION_CLASSES = [
    MoveNoteSearchAction,
    DeleteNoteSearchAction,
    DeleteNoteRevisionsSearchAction,
    DeleteLabelSearchAction,
    DeleteRelationSearchAction,
    RenameLabelSearchAction,
    RenameRelationSearchAction,
    SetLabelValueSearchAction,
    SetRelationTargetSearchAction,
    ExecuteScriptSearchAction
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