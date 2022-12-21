const log = require("./log");
const noteRevisionService = require("./note_revisions");
const becca = require("../becca/becca");
const cloningService = require("./cloning");
const branchService = require("./branches");
const utils = require("./utils");

const ACTION_HANDLERS = {
    addLabel: (action, note) => {
        note.addLabel(action.labelName, action.labelValue);
    },
    addRelation: (action, note) => {
        note.addRelation(action.relationName, action.targetNoteId);
    },
    deleteNote: (action, note) => {
        const deleteId = `searchbulkaction-${utils.randomString(10)}`;

        note.deleteNote(deleteId);
    },
    deleteNoteRevisions: (action, note) => {
        noteRevisionService.eraseNoteRevisions(note.getNoteRevisions().map(rev => rev.noteRevisionId));
    },
    deleteLabel: (action, note) => {
        for (const label of note.getOwnedLabels(action.labelName)) {
            label.markAsDeleted();
        }
    },
    deleteRelation: (action, note) => {
        for (const relation of note.getOwnedRelations(action.relationName)) {
            relation.markAsDeleted();
        }
    },
    renameNote: (action, note) => {
        // "officially" injected value:
        // - note

        const newTitle = eval(`\`${action.newTitle}\``);

        if (note.title !== newTitle) {
            note.title = newTitle;
            note.save();
        }
    },
    renameLabel: (action, note) => {
        for (const label of note.getOwnedLabels(action.oldLabelName)) {
            // attribute name is immutable, renaming means delete old + create new
            const newLabel = label.createClone('label', action.newLabelName, label.value);

            newLabel.save();
            label.markAsDeleted();
        }
    },
    renameRelation: (action, note) => {
        for (const relation of note.getOwnedRelations(action.oldRelationName)) {
            // attribute name is immutable, renaming means delete old + create new
            const newRelation = relation.createClone('relation', action.newRelationName, relation.value);

            newRelation.save();
            relation.markAsDeleted();
        }
    },
    updateLabelValue: (action, note) => {
        for (const label of note.getOwnedLabels(action.labelName)) {
            label.value = action.labelValue;
            label.save();
        }
    },
    updateRelationTarget: (action, note) => {
        for (const relation of note.getOwnedRelations(action.relationName)) {
            relation.value = action.targetNoteId;
            relation.save();
        }
    },
    moveNote: (action, note) => {
        const targetParentNote = becca.getNote(action.targetParentNoteId);

        if (!targetParentNote) {
            log.info(`Cannot execute moveNote because note ${action.targetParentNoteId} doesn't exist.`);

            return;
        }

        let res;

        if (note.getParentBranches().length > 1) {
            res = cloningService.cloneNoteToNote(note.noteId, action.targetParentNoteId);
        }
        else {
            res = branchService.moveBranchToNote(note.getParentBranches()[0], action.targetParentNoteId);
        }

        if (!res.success) {
            log.info(`Moving/cloning note ${note.noteId} to ${action.targetParentNoteId} failed with error ${JSON.stringify(res)}`);
        }
    },
    executeScript: (action, note) => {
        if (!action.script || !action.script.trim()) {
            log.info("Ignoring executeScript since the script is empty.")
            return;
        }

        const scriptFunc = new Function("note", action.script);
        scriptFunc(note);

        note.save();
    }
};

function getActions(note) {
    return note.getLabels('action')
        .map(actionLabel => {
            let action;

            try {
                action = JSON.parse(actionLabel.value);
            } catch (e) {
                log.error(`Cannot parse '${actionLabel.value}' into search action, skipping.`);
                return null;
            }

            if (!(action.name in ACTION_HANDLERS)) {
                log.error(`Cannot find '${action.name}' search action handler, skipping.`);
                return null;
            }

            return action;
        })
        .filter(a => !!a);
}

function executeActions(note, searchResultNoteIds) {
    const actions = getActions(note);

    for (const resultNoteId of searchResultNoteIds) {
        const resultNote = becca.getNote(resultNoteId);

        if (!resultNote || resultNote.isDeleted) {
            continue;
        }

        for (const action of actions) {
            try {
                log.info(`Applying action handler to note ${resultNote.noteId}: ${JSON.stringify(action)}`);

                ACTION_HANDLERS[action.name](action, resultNote);
            } catch (e) {
                log.error(`ExecuteScript search action failed with ${e.message}`);
            }
        }
    }
}

module.exports = {
    executeActions
};
