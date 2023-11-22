"use strict";

const scriptService = require('../../services/script.js');
const attributeService = require('../../services/attributes.js');
const becca = require('../../becca/becca.js');
const syncService = require('../../services/sync.js');
const sql = require('../../services/sql.js');

// The async/await here is very confusing, because the body.script may, but may not be async. If it is async, then we
// need to await it and make the complete response including metadata available in a Promise, so that the route detects
// this and does result.then().
async function exec(req) {
    try {
        const {body} = req;

        const execute = body => scriptService.executeScript(
            body.script,
            body.params,
            body.startNoteId,
            body.currentNoteId,
            body.originEntityName,
            body.originEntityId
        );

        const result = body.transactional
            ? sql.transactional(() => execute(body))
            : await execute(body);

        return {
            success: true,
            executionResult: result,
            maxEntityChangeId: syncService.getMaxEntityChangeId()
        };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
}

function run(req) {
    const note = becca.getNote(req.params.noteId);

    const result = scriptService.executeNote(note, { originEntity: note });

    return { executionResult: result };
}

function getBundlesWithLabel(label, value) {
    const notes = attributeService.getNotesWithLabel(label, value);

    const bundles = [];

    for (const note of notes) {
        const bundle = scriptService.getScriptBundleForFrontend(note);

        if (bundle) {
            bundles.push(bundle);
        }
    }

    return bundles;
}

function getStartupBundles(req) {
    if (!process.env.TRILIUM_SAFE_MODE) {
        if (req.query.mobile === "true") {
            return getBundlesWithLabel("run", "mobileStartup");
        }
        else {
            return getBundlesWithLabel("run", "frontendStartup");
        }
    }
    else {
        return [];
    }
}

function getWidgetBundles() {
    if (!process.env.TRILIUM_SAFE_MODE) {
        return getBundlesWithLabel("widget");
    }
    else {
        return [];
    }
}

function getRelationBundles(req) {
    const noteId = req.params.noteId;
    const note = becca.getNote(noteId);
    const relationName = req.params.relationName;

    const attributes = note.getAttributes();
    const filtered = attributes.filter(attr => attr.type === 'relation' && attr.name === relationName);
    const targetNoteIds = filtered.map(relation => relation.value);
    const uniqueNoteIds = Array.from(new Set(targetNoteIds));

    const bundles = [];

    for (const noteId of uniqueNoteIds) {
        const note = becca.getNote(noteId);

        if (!note.isJavaScript() || note.getScriptEnv() !== 'frontend') {
            continue;
        }

        const bundle = scriptService.getScriptBundleForFrontend(note);

        if (bundle) {
            bundles.push(bundle);
        }
    }

    return bundles;
}

function getBundle(req) {
    const note = becca.getNote(req.params.noteId);
    const {script, params} = req.body;

    return scriptService.getScriptBundleForFrontend(note, script, params);
}

module.exports = {
    exec,
    run,
    getStartupBundles,
    getWidgetBundles,
    getRelationBundles,
    getBundle
};
