const sql = require('./sql');
const ScriptContext = require('./script_context');

async function executeNote(note) {
    if (note.isProtected || !note.isJavaScript()) {
        return;
    }

    const manualTransactionHandling = (await note.getAttributeMap()).manual_transaction_handling !== undefined;

    const modules = await getModules([note], []);

    // last \r\n is necessary if script contains line comment on its last line
    const script = "async function() {\r\n" + modules.script + "\r\n}";

    const ctx = new ScriptContext(null, note, module.allModules);

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
    console.log(`const api = this; (${script})(${paramsStr})`);

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

async function getNoteScript(note) {

}

/**
 * @param includedNoteIds - if multiple child note scripts reference same dependency (child note),
 *                          it will be included just once
 */
async function getModules(children, includedNoteIds) {
    const modules = [];
    let allModules = [];
    let script = '';

    for (const child of children) {
        if (!child.isJavaScript()) {
            continue;
        }

        modules.push(child);

        if (includedNoteIds.includes(child.noteId)) {
            continue;
        }

        includedNoteIds.push(child.noteId);

        const children = await getModules(await child.getChildren(), includedNoteIds);

        allModules = allModules.concat(children.allModules);

        script += children.script;

        script += `
api.__modules['${child.noteId}'] = {};
await (async function(module, api, startNote, currentNote` + (children.modules.length > 0 ? ', ' : '') +
        children.modules.map(child => child.title).join(', ') + `) {
${child.content}
})(api.__modules['${child.noteId}'], api, api.__startNote, api.__notes['${child.noteId}']` + (children.modules.length > 0 ? ', ' : '') +
        children.modules.map(child => `api.__modules['${child.noteId}'].exports`).join(', ') + `);
`;
    }

    allModules = allModules.concat(modules);

    return { script, modules, allModules };
}

module.exports = {
    executeNote,
    executeScript,
    setJob,
    getNoteScript,
    getRenderScript
};