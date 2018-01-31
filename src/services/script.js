const log = require('./log');
const sql = require('./sql');
const ScriptContext = require('./script_context');

async function executeScript(noteId, dataKey, script, params) {
    log.info('Executing script: ' + script);

    const ctx = new ScriptContext(noteId, dataKey);

    const paramsStr = getParams(params);

    let ret;

    await sql.doInTransaction(async () => {
        ret = await (function() { return eval(`(${script})(${paramsStr})`); }.call(ctx));
    });

    return ret;
}

function getParams(params) {
    return params.map(p => JSON.stringify(p)).join(",");
}

module.exports = {
    executeScript
};