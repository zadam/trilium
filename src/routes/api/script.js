"use strict";

const labels = require('../../services/labels');
const script = require('../../services/script');
const repository = require('../../services/repository');

async function exec(req) {
    const result = await script.executeScript(req.body.script, req.body.params, req.body.startNoteId, req.body.currentNoteId);

    return { executionResult: result };
}

async function run(req) {
    const note = await repository.getNote(req.params.noteId);

    const result = await script.executeNote(req, note);

    return { executionResult: result };
}

async function getStartupBundles(req) {
    const notes = await labels.getNotesWithLabel("run", "frontend_startup");

    const bundles = [];

    for (const note of notes) {
        const bundle = await script.getScriptBundle(note);

        if (bundle) {
            bundles.push(bundle);
        }
    }

    return bundles;
}

async function getBundle(req) {
    const note = await repository.getNote(req.params.noteId);
    return await script.getScriptBundle(note);
}

module.exports = {
    exec,
    run,
    getStartupBundles,
    getBundle
};