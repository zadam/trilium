const sql = require('./sql');
const ScriptContext = require('./script_context');

async function executeNote(note) {
    if (note.isProtected || !note.isJavaScript()) {
        return;
    }

    const ctx = new ScriptContext();

    return await sql.doInTransaction(async () => {
        return await (function() { return eval(`const api = this; (async function() {${note.content}\n\r})()`); }.call(ctx));
    });
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

module.exports = {
    executeNote,
    executeScript,
    setJob
};