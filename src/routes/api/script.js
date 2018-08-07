"use strict";

const labelService = require('../../services/labels');
const scriptService = require('../../services/script');
const attributeService = require('../../services/attributes');
const repository = require('../../services/repository');

async function exec(req) {
    const result = await scriptService.executeScript(req.body.script, req.body.params, req.body.startNoteId,
        req.body.currentNoteId, req.body.workNoteId);

    return { executionResult: result };
}

async function run(req) {
    const note = await repository.getNote(req.params.noteId);

    const result = await scriptService.executeNote(req, note);

    return { executionResult: result };
}

async function getStartupBundles() {
    const notes = await labelService.getNotesWithLabel("run", "frontendStartup");

    const bundles = [];

    for (const note of notes) {
        const bundle = await scriptService.getScriptBundle(note);

        if (bundle) {
            bundles.push(bundle);
        }
    }

    return bundles;
}

async function getRelationBundles(req) {
    const noteId = req.params.noteId;
    const relationName = req.params.relationName;

    const attributes = await attributeService.getEffectiveAttributes(noteId);
    const filtered = attributes.filter(attr => attr.type === 'relation' && attr.name === relationName);
    const targetNoteIds = filtered.map(relation => relation.value);
    const uniqueNoteIds = Array.from(new Set(targetNoteIds));

    const bundles = [];

    for (const noteId of uniqueNoteIds) {
        bundles.push(await scriptService.getScriptBundleForNoteId(noteId));
    }

    return bundles;
}

async function getBundle(req) {
    return await scriptService.getScriptBundleForNoteId(req.params.noteId);
}

module.exports = {
    exec,
    run,
    getStartupBundles,
    getRelationBundles,
    getBundle
};