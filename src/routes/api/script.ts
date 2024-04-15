"use strict";

import scriptService = require('../../services/script');
import attributeService = require('../../services/attributes');
import becca = require('../../becca/becca');
import syncService = require('../../services/sync');
import sql = require('../../services/sql');
import { Request } from 'express';

interface ScriptBody {
    script: string;
    params: any[];
    startNoteId: string;
    currentNoteId: string;
    originEntityName: string;
    originEntityId: string;
    transactional: boolean;
}

// The async/await here is very confusing, because the body.script may, but may not be async. If it is async, then we
// need to await it and make the complete response including metadata available in a Promise, so that the route detects
// this and does result.then().
async function exec(req: Request) {
    try {
        const body = (req.body as ScriptBody);

        const execute = (body: ScriptBody) => scriptService.executeScript(
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
    catch (e: any) {
        return { success: false, error: e.message };
    }
}

function run(req: Request) {
    const note = becca.getNoteOrThrow(req.params.noteId);

    const result = scriptService.executeNote(note, { originEntity: note });

    return { executionResult: result };
}

function getBundlesWithLabel(label: string, value?: string) {
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

function getStartupBundles(req: Request) {
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

function getRelationBundles(req: Request) {
    const noteId = req.params.noteId;
    const note = becca.getNoteOrThrow(noteId);
    const relationName = req.params.relationName;

    const attributes = note.getAttributes();
    const filtered = attributes.filter(attr => attr.type === 'relation' && attr.name === relationName);
    const targetNoteIds = filtered.map(relation => relation.value);
    const uniqueNoteIds = Array.from(new Set(targetNoteIds));

    const bundles = [];

    for (const noteId of uniqueNoteIds) {
        const note = becca.getNoteOrThrow(noteId);

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

function getBundle(req: Request) {
    const note = becca.getNoteOrThrow(req.params.noteId);
    const { script, params } = req.body;

    return scriptService.getScriptBundleForFrontend(note, script, params);
}

export = {
    exec,
    run,
    getStartupBundles,
    getWidgetBundles,
    getRelationBundles,
    getBundle
};
