const sql = require('./sql');
const ScriptContext = require('./script_context');
const repository = require('./repository');
const cls = require('./cls');
const log = require('./log');

async function executeNote(note, apiParams) {
    if (!note.isJavaScript() || note.getScriptEnv() !== 'backend' || !note.isContentAvailable) {
        log.info(`Cannot execute note ${note.noteId}`);

        return;
    }

    const bundle = await getScriptBundle(note);

    return await executeBundle(bundle, apiParams);
}

async function executeNoteNoException(note, apiParams) {
    try {
        await executeNote(note, apiParams);
    }
    catch (e) {
        // just swallow, exception is logged already in executeNote
    }
}

async function executeBundle(bundle, apiParams = {}) {
    if (!apiParams.startNote) {
        // this is the default case, the only exception is when we want to preserve frontend startNote
        apiParams.startNote = bundle.note;
    }

    cls.set('sourceId', 'script');

    // last \r\n is necessary if script contains line comment on its last line
    const script = "async function() {\r\n" + bundle.script + "\r\n}";

    const ctx = new ScriptContext(bundle.allNotes, apiParams);

    try {
        if (await bundle.note.hasOwnedLabel('manualTransactionHandling')) {
            return await execute(ctx, script);
        }
        else {
            return await sql.transactional(async () => await execute(ctx, script));
        }
    }
    catch (e) {
        log.error(`Execution of script "${bundle.note.title}" (${bundle.note.noteId}) failed with error: ${e.message}`);

        throw e;
    }
}

/**
 * This method preserves frontend startNode - that's why we start execution from currentNote and override
 * bundle's startNote.
 */
async function executeScript(script, params, startNoteId, currentNoteId, originEntityName, originEntityId) {
    const startNote = await repository.getNote(startNoteId);
    const currentNote = await repository.getNote(currentNoteId);
    const originEntity = await repository.getEntityFromName(originEntityName, originEntityId);

    currentNote.content = `return await (${script}\r\n)(${getParams(params)})`;
    currentNote.type = 'code';
    currentNote.mime = 'application/javascript;env=backend';

    const bundle = await getScriptBundle(currentNote);

    return await executeBundle(bundle, { startNote, originEntity });
}

async function execute(ctx, script) {
    return await (function() { return eval(`const apiContext = this;\r\n(${script}\r\n)()`); }.call(ctx));
}

function getParams(params) {
    if (!params) {
        return params;
    }

    return params.map(p => {
        if (typeof p === "string" && p.startsWith("!@#Function: ")) {
            return p.substr(13);
        }
        else {
            return JSON.stringify(p);
        }
    }).join(",");
}

async function getScriptBundleForFrontend(note) {
    const bundle = await getScriptBundle(note);

    if (!bundle) {
        return;
    }

    // for frontend we return just noteIds because frontend needs to use its own entity instances
    bundle.noteId = bundle.note.noteId;
    delete bundle.note;

    bundle.allNoteIds = bundle.allNotes.map(note => note.noteId);
    delete bundle.allNotes;

    return bundle;
}

async function getScriptBundle(note, root = true, scriptEnv = null, includedNoteIds = []) {
    if (!note.isContentAvailable) {
        return;
    }

    if (!note.isJavaScript() && !note.isHtml()) {
        return;
    }

    if (!root && await note.hasOwnedLabel('disableInclusion')) {
        return;
    }

    if (root) {
        scriptEnv = note.getScriptEnv();
    }

    if (note.type !== 'file' && scriptEnv !== note.getScriptEnv()) {
        return;
    }

    const bundle = {
        note: note,
        script: '',
        html: '',
        allNotes: [note]
    };

    if (includedNoteIds.includes(note.noteId)) {
        return bundle;
    }

    includedNoteIds.push(note.noteId);

    const modules = [];

    for (const child of await note.getChildNotes()) {
        const childBundle = await getScriptBundle(child, false, scriptEnv, includedNoteIds);

        if (childBundle) {
            modules.push(childBundle.note);
            bundle.script += childBundle.script;
            bundle.html += childBundle.html;
            bundle.allNotes = bundle.allNotes.concat(childBundle.allNotes);
        }
    }

    const moduleNoteIds = modules.map(mod => mod.noteId);

    if (note.isJavaScript()) {
        bundle.script += `
apiContext.modules['${note.noteId}'] = {};
${root ? 'return ' : ''}await ((async function(exports, module, require, api` + (modules.length > 0 ? ', ' : '') +
            modules.map(child => sanitizeVariableName(child.title)).join(', ') + `) {
try {
${await note.getContent()};
} catch (e) { throw new Error("Load of script note \\"${note.title}\\" (${note.noteId}) failed with: " + e.message); }
if (!module.exports) module.exports = {};
for (const exportKey in exports) module.exports[exportKey] = exports[exportKey];
return module.exports;
}).call({}, {}, apiContext.modules['${note.noteId}'], apiContext.require(${JSON.stringify(moduleNoteIds)}), apiContext.apis['${note.noteId}']` + (modules.length > 0 ? ', ' : '') +
            modules.map(mod => `apiContext.modules['${mod.noteId}'].exports`).join(', ') + `));
`;
    }
    else if (note.isHtml()) {
        bundle.html += await note.getContent();
    }

    return bundle;
}

function sanitizeVariableName(str) {
    return str.replace(/[^a-z0-9_]/gim, "");
}

module.exports = {
    executeNote,
    executeNoteNoException,
    executeScript,
    getScriptBundleForFrontend
};
