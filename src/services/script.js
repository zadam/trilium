const log = require('./log');
const sql = require('./sql');
const ScriptContext = require('./script_context');

async function executeScript(dataKey, script, params) {
    log.info('Executing script: ' + script);

    const ctx = new ScriptContext(dataKey);

    const paramsStr = getParams(params);

    let ret;

    await sql.doInTransaction(async () => {
        ret = await (function() { return eval(`(${script})(${paramsStr})`); }.call(ctx));
    });

    return ret;
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

async function setJob(opts) {
    clearExistingJob(opts.name);

    if (opts.runEveryMs && opts.runEveryMs > 0) {
        intervals[opts.name] = setInterval(() => executeScript(null, opts.job, opts.params), opts.runEveryMs);
    }

    if (opts.initialRunAfterMs && opts.initialRunAfterMs > 0) {
        timeouts[opts.name] = setTimeout(() => executeScript(null, opts.job, opts.params), opts.initialRunAfterMs);
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
    executeScript,
    setJob
};