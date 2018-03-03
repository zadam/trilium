const sql = require('./sql');
const ScriptContext = require('./script_context');

async function executeNote(note) {
    if (note.isProtected || !note.isJavaScript()) {
        return;
    }

    const manualTransactionHandling = (await note.getAttributeMap()).manual_transaction_handling !== undefined;
    const noteScript = await getNoteScript(note);

    return await executeJob(noteScript, [], manualTransactionHandling);
}

async function executeScript(dataKey, script, params) {
    const ctx = new ScriptContext(dataKey);
    const paramsStr = getParams(params);

    return await sql.doInTransaction(async () => execute(ctx, script, paramsStr));
}

async function execute(ctx, script, paramsStr) {
    return await (function() { return eval(`const api = this; (${script})(${paramsStr})`); }.call(ctx));
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

async function getNoteScript(note) {
    const subTreeScripts = await getSubTreeScripts(note, [note.noteId]);

    // last \r\n is necessary if script contains line comment on its last line
    return "async function() {" + subTreeScripts + note.content + "\r\n}";
}

/**
 * @param includedNoteIds - if multiple child note scripts reference same dependency (child note),
 *                          it will be included just once
 */
async function getSubTreeScripts(parent, includedNoteIds) {
    let script = "\r\n";

    for (const child of await parent.getChildren()) {
        if (!child.isJavaScript() || includedNoteIds.includes(child.noteId)) {
            continue;
        }

        includedNoteIds.push(child.noteId);

        script += await getSubTreeScripts(child.noteId, includedNoteIds);

        script += child.content + "\r\n";
    }

    return script;
}

module.exports = {
    executeNote,
    executeScript,
    setJob,
    getNoteScript
};