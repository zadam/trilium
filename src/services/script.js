const sql = require('./sql');
const ScriptContext = require('./script_context');

async function executeNote(note) {
    if (note.isProtected || !note.isJavaScript()) {
        return;
    }

    const manualTransactionHandling = (await note.getAttributeMap()).manual_transaction_handling !== undefined;

    const bundle = await getScriptBundle(note);

    // last \r\n is necessary if script contains line comment on its last line
    const script = "async function() {\r\n" + bundle.script + "\r\n}";

    const ctx = new ScriptContext(null, note, bundle.allNotes);

    if (manualTransactionHandling) {
        return await execute(ctx, script, '');
    }
    else {
        return await sql.doInTransaction(async () => execute(ctx, script, ''));
    }
}

async function executeScript(dataKey, script, params) {
    const ctx = new ScriptContext(dataKey);
    const paramsStr = getParams(params);

    return await sql.doInTransaction(async () => execute(ctx, script, paramsStr));
}

async function execute(ctx, script, paramsStr) {
    return await (function() { return eval(`const api = this;\r\n(${script})(${paramsStr})`); }.call(ctx));
}

const timeouts = {};
const intervals = {};

function clearExistingJob(name) {
    if (timeouts[name]) {
        clearTimeout(timeouts[name]);

        delete timeouts[name];
    }

    if (intervals[name]) {
        clearInterval(intervals[name]);

        delete intervals[name];
    }
}

async function executeJob(script, params, manualTransactionHandling) {
    const ctx = new ScriptContext();
    const paramsStr = getParams(params);

    if (manualTransactionHandling) {
        return await execute(ctx, script, paramsStr);
    }
    else {
        return await sql.doInTransaction(async () => execute(ctx, script, paramsStr));
    }
}

async function setJob(opts) {
    const { name, runEveryMs, initialRunAfterMs } = opts;

    clearExistingJob(name);

    const jobFunc = () => executeJob(opts.job, opts.params, opts.manualTransactionHandling);

    if (runEveryMs && runEveryMs > 0) {
        intervals[name] = setInterval(jobFunc, runEveryMs);
    }

    if (initialRunAfterMs && initialRunAfterMs > 0) {
        timeouts[name] = setTimeout(jobFunc, initialRunAfterMs);
    }
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

async function getRenderScript(note) {
    const subTreeScripts = await getModules(note, [note.noteId]);

    // last \r\n is necessary if script contains line comment on its last line
    return "async function() {" + subTreeScripts + note.content + "\r\n}";
}

async function getScriptBundle(note, includedNoteIds = []) {
    if (!note.isJavaScript()) {
        return;
    }

    const bundle = {
        note: note,
        script: '',
        allNotes: [note]
    };

    if (includedNoteIds.includes(note.noteId)) {
        return bundle;
    }

    includedNoteIds.push(note.noteId);

    const modules = [];

    for (const child of await note.getChildren()) {
        const childBundle = await getScriptBundle(child, includedNoteIds);

        if (childBundle) {
            modules.push(childBundle.note);
            bundle.script += childBundle.script;
            bundle.allNotes = bundle.allNotes.concat(childBundle.allNotes);
        }
    }

    bundle.script += `
api.__modules['${note.noteId}'] = {};
await (async function(module, api, startNote, currentNote` + (modules.length > 0 ? ', ' : '') +
        modules.map(child => child.title).join(', ') + `) {
${note.content}
})(api.__modules['${note.noteId}'], api, api.__startNote, api.__notes['${note.noteId}']` + (modules.length > 0 ? ', ' : '') +
        modules.map(mod => `api.__modules['${mod.noteId}'].exports`).join(', ') + `);
`;

    return bundle;
}

module.exports = {
    executeNote,
    executeScript,
    setJob,
    getScriptBundle,
    getRenderScript
};