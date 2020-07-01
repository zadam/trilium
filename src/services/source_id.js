const utils = require('./utils');
const dateUtils = require('./date_utils');
const log = require('./log');
const sql = require('./sql');
const sqlInit = require('./sql_init');
const cls = require('./cls');

function saveSourceId(sourceId) {
    sql.insert("source_ids", {
        sourceId: sourceId,
        utcDateCreated: dateUtils.utcNowDateTime()
    });

    refreshSourceIds();
}

function createSourceId() {
    const sourceId = utils.randomString(12);

    log.info("Generated sourceId=" + sourceId);
    return sourceId;
}

function generateSourceId() {
    const sourceId = createSourceId();

    saveSourceId(sourceId);

    return sourceId;
}

function refreshSourceIds() {
    const sourceIdsArr = sql.getColumn("SELECT sourceId FROM source_ids ORDER BY utcDateCreated DESC");

    allSourceIds = {};

    for (const sourceId of sourceIdsArr) {
        allSourceIds[sourceId] = true;
    }
}

let allSourceIds = {};

function isLocalSourceId(srcId) {
    return !!allSourceIds[srcId];
}

const currentSourceId = createSourceId();

sqlInit.dbReady.then(cls.wrap(() => saveSourceId(currentSourceId)));

function getCurrentSourceId() {
    return currentSourceId;
}

module.exports = {
    generateSourceId,
    getCurrentSourceId,
    isLocalSourceId
};
