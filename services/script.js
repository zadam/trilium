const log = require('./log');
const protected_session = require('./protected_session');

async function executeScript(dataKey, script, params) {
    log.info('Executing script: ' + script);

    const ctx = {
        dataKey: protected_session.getDataKey(dataKey)
    };

    params.unshift(ctx);

    const paramsStr = getParams(params);

    const ret = await eval(`(${script})(${paramsStr})`);

    log.info('Execution result: ' + ret);

    return ret;
}

function getParams(params) {
    return params.map(p => JSON.stringify(p)).join(",");
}

module.exports = {
    executeScript
};