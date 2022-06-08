"use strict";

const becca = require('../../becca/becca');
const SearchContext = require('../../services/search/search_context');
const log = require('../../services/log');
const scriptService = require('../../services/script');
const searchService = require('../../services/search/services/search');
const noteRevisionService = require("../../services/note_revisions");
const branchService = require("../../services/branches");
const cloningService = require("../../services/cloning");
const {formatAttrForSearch} = require("../../services/attribute_formatter");
const utils = require("../../services/utils.js");

function searchFromNoteInt(note) {
    let searchResultNoteIds;

    const searchScript = note.getRelationValue('searchScript');
    const searchString = note.getLabelValue('searchString');

    if (searchScript) {
        searchResultNoteIds = searchFromRelation(note, 'searchScript');
    } else {
        const searchContext = new SearchContext({
            fastSearch: note.hasLabel('fastSearch'),
            ancestorNoteId: note.getRelationValue('ancestor'),
            ancestorDepth: note.getLabelValue('ancestorDepth'),
            includeArchivedNotes: note.hasLabel('includeArchivedNotes'),
            orderBy: note.getLabelValue('orderBy'),
            orderDirection: note.getLabelValue('orderDirection'),
            limit: note.getLabelValue('limit'),
            debug: note.hasLabel('debug'),
            fuzzyAttributeSearch: false
        });

        searchResultNoteIds = searchService.findResultsWithQuery(searchString, searchContext)
            .map(sr => sr.noteId);
    }

    // we won't return search note's own noteId
    // also don't allow root since that would force infinite cycle
    return searchResultNoteIds.filter(resultNoteId => !['root', note.noteId].includes(resultNoteId));
}

async function searchFromNote(req) {
    const note = becca.getNote(req.params.noteId);

    if (!note) {
        return [404, `Note ${req.params.noteId} has not been found.`];
    }

    if (note.isDeleted) {
        // this can be triggered from recent changes and it's harmless to return empty list rather than fail
        return [];
    }

    if (note.type !== 'search') {
        return [400, `Note ${req.params.noteId} is not a search note.`]
    }

    return await searchFromNoteInt(note);
}

const ACTION_HANDLERS = {
    deleteNote: (action, note) => {
        const deleteId = 'searchbulkaction-' + utils.randomString(10);

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
    renameLabel: (action, note) => {
        for (const label of note.getOwnedLabels(action.oldLabelName)) {
            label.name = action.newLabelName;
            label.save();
        }
    },
    renameRelation: (action, note) => {
        for (const relation of note.getOwnedRelations(action.oldRelationName)) {
            relation.name = action.newRelationName;
            relation.save();
        }
    },
    setLabelValue: (action, note) => {
        note.setLabel(action.labelName, action.labelValue);
    },
    setRelationTarget: (action, note) => {
        note.setRelation(action.relationName, action.targetNoteId);
    },
    moveNote: (action, note) => {
        const targetParentNote = becca.getNote(action.targetParentNoteId);

        if (!targetParentNote) {
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

function searchAndExecute(req) {
    const note = becca.getNote(req.params.noteId);

    if (!note) {
        return [404, `Note ${req.params.noteId} has not been found.`];
    }

    if (note.isDeleted) {
        // this can be triggered from recent changes and it's harmless to return empty list rather than fail
        return [];
    }

    if (note.type !== 'search') {
        return [400, `Note ${req.params.noteId} is not a search note.`]
    }

    const searchResultNoteIds = searchFromNoteInt(note);

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
            }
            catch (e) {
                log.error(`ExecuteScript search action failed with ${e.message}`);
            }
        }
    }
}

function searchFromRelation(note, relationName) {
    const scriptNote = note.getRelationTarget(relationName);

    if (!scriptNote) {
        log.info(`Search note's relation ${relationName} has not been found.`);

        return [];
    }

    if (!scriptNote.isJavaScript() || scriptNote.getScriptEnv() !== 'backend') {
        log.info(`Note ${scriptNote.noteId} is not executable.`);

        return [];
    }

    if (!note.isContentAvailable()) {
        log.info(`Note ${scriptNote.noteId} is not available outside of protected session.`);

        return [];
    }

    const result = scriptService.executeNote(scriptNote, { originEntity: note });

    if (!Array.isArray(result)) {
        log.info(`Result from ${scriptNote.noteId} is not an array.`);

        return [];
    }

    if (result.length === 0) {
        return [];
    }

    // we expect either array of noteIds (strings) or notes, in that case we extract noteIds ourselves
    return typeof result[0] === 'string' ? result : result.map(item => item.noteId);
}

function quickSearch(req) {
    const {searchString} = req.params;

    const searchContext = new SearchContext({
        fastSearch: false,
        includeArchivedNotes: false,
        fuzzyAttributeSearch: false
    });

    return searchService.findResultsWithQuery(searchString, searchContext)
        .map(sr => sr.noteId);
}

function search(req) {
    const {searchString} = req.params;

    const searchContext = new SearchContext({
        fastSearch: false,
        includeArchivedNotes: true,
        fuzzyAttributeSearch: false,
        ignoreHoistedNote: true
    });

    return searchService.findResultsWithQuery(searchString, searchContext)
        .map(sr => sr.noteId);
}

function getRelatedNotes(req) {
    const attr = req.body;

    const searchSettings = {
        fastSearch: true,
        includeArchivedNotes: false,
        fuzzyAttributeSearch: false
    };

    const matchingNameAndValue = searchService.findResultsWithQuery(formatAttrForSearch(attr, true), new SearchContext(searchSettings));
    const matchingName = searchService.findResultsWithQuery(formatAttrForSearch(attr, false), new SearchContext(searchSettings));

    const results = [];

    const allResults = matchingNameAndValue.concat(matchingName);

    const allResultNoteIds = new Set();

    for (const record of allResults) {
        allResultNoteIds.add(record.noteId);
    }

    for (const record of allResults) {
        if (results.length >= 20) {
            break;
        }

        if (results.find(res => res.noteId === record.noteId)) {
            continue;
        }

        results.push(record);
    }

    return {
        count: allResultNoteIds.size,
        results
    };
}

module.exports = {
    searchFromNote,
    searchAndExecute,
    getRelatedNotes,
    quickSearch,
    search
};
