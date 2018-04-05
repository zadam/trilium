"use strict";

const labelService = require('../../services/labels');
const scriptService = require('../../services/script');
const repository = require('../../services/repository');

async function exec(req) {
    const result = await scriptService.executeScript(req.body.script, req.body.params, req.body.startNoteId, req.body.currentNoteId);

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

async function getBundle(req) {
    const note = await repository.getNote(req.params.noteId);
    return await scriptService.getScriptBundle(note);
}

module.exports = {
    exec,
    run,
    getStartupBundles,
    getBundle
};