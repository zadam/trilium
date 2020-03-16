"use strict";

const scriptService = require('../../services/script');
const attributeService = require('../../services/attributes');
const repository = require('../../services/repository');
const syncService = require('../../services/sync');

async function exec(req) {
    try {
        const result = await scriptService.executeScript(req.body.script, req.body.params, req.body.startNoteId,
            req.body.currentNoteId, req.body.originEntityName, req.body.originEntityId);

        return {
            success: true,
            executionResult: result,
            maxSyncId: await syncService.getMaxSyncId()
        };
    }
    catch (e) {
        return { success: false, error: e.message };
    }
}

async function run(req) {
    const note = await repository.getNote(req.params.noteId);

    const result = await scriptService.executeNote(note, { originEntity: note });

    return { executionResult: result };
}

async function getBundlesWithLabel(label, value) {
    const notes = await attributeService.getNotesWithLabel(label, value);

    const bundles = [];

    for (const note of notes) {
        const bundle = await scriptService.getScriptBundleForFrontend(note);

        if (bundle) {
            bundles.push(bundle);
        }
    }

    return bundles;
}

async function getStartupBundles() {
    return await getBundlesWithLabel("run", "frontendStartup");
}

async function getWidgetBundles() {
    return await getBundlesWithLabel("widget");
}

async function getRelationBundles(req) {
    const noteId = req.params.noteId;
    const note = await repository.getNote(noteId);
    const relationName = req.params.relationName;

    const attributes = await note.getAttributes();
    const filtered = attributes.filter(attr => attr.type === 'relation' && attr.name === relationName);
    const targetNoteIds = filtered.map(relation => relation.value);
    const uniqueNoteIds = Array.from(new Set(targetNoteIds));

    const bundles = [];

    for (const noteId of uniqueNoteIds) {
        const note = await repository.getNote(noteId);

        if (!note.isJavaScript() || note.getScriptEnv() !== 'frontend') {
            continue;
        }

        const bundle = await scriptService.getScriptBundleForFrontend(note);

        if (bundle) {
            bundles.push(bundle);
        }
    }

    return bundles;
}

async function getBundle(req) {
    const note = await repository.getNote(req.params.noteId);

    return await scriptService.getScriptBundleForFrontend(note);
}

module.exports = {
    exec,
    run,
    getStartupBundles,
    getWidgetBundles,
    getRelationBundles,
    getBundle
};