"use strict";

const scriptService = require('../../services/script');
const attributeService = require('../../services/attributes');
const repository = require('../../services/repository');
const syncService = require('../../services/sync');

function exec(req) {
    try {
        const result = scriptService.executeScript(req.body.script, req.body.params, req.body.startNoteId,
            req.body.currentNoteId, req.body.originEntityName, req.body.originEntityId);

        return {
            success: true,
            executionResult: result,
            maxSyncId: syncService.getMaxSyncId()
        };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
}

function run(req) {
    const note = repository.getNote(req.params.noteId);

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

function getStartupBundles() {
    return getBundlesWithLabel("run", "frontendStartup");
}

function getWidgetBundles() {
    return getBundlesWithLabel("widget");
}

function getRelationBundles(req) {
    const noteId = req.params.noteId;
    const note = repository.getNote(noteId);
    const relationName = req.params.relationName;

    const attributes = note.getAttributes();
    const filtered = attributes.filter(attr => attr.type === 'relation' && attr.name === relationName);
    const targetNoteIds = filtered.map(relation => relation.value);
    const uniqueNoteIds = Array.from(new Set(targetNoteIds));

    const bundles = [];

    for (const noteId of uniqueNoteIds) {
        const note = repository.getNote(noteId);

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
    const note = repository.getNote(req.params.noteId);

    return scriptService.getScriptBundleForFrontend(note);
}

module.exports = {
    exec,
    run,
    getStartupBundles,
    getWidgetBundles,
    getRelationBundles,
    getBundle
};
