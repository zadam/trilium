"use strict";

const labels = require('../../services/labels');
const script = require('../../services/script');
const Repository = require('../../services/repository');

async function exec(req) {
    const ret = await script.executeScript(req, req.body.script, req.body.params, req.body.startNoteId, req.body.currentNoteId);

    return {
        executionResult: ret
    };
}

async function run(req) {
    const repository = new Repository(req);
    const note = await repository.getNote(req.params.noteId);

    const ret = await script.executeNote(req, note);

    return {
        executionResult: ret
    };
}

async function getStartupBundles(req) {
    const repository = new Repository(req);
    const notes = await labels.getNotesWithLabel(repository, "run", "frontend_startup");

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
    const repository = new Repository(req);
    const note = await repository.getNote(req.params.noteId);
    const bundle = await script.getScriptBundle(note);

    return bundle;
}

module.exports = {
    exec,
    run,
    getStartupBundles,
    getBundle
};