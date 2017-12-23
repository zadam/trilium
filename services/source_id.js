const utils = require('./utils');
const log = require('./log');
const sql = require('./sql');

async function saveSourceId(sourceId) {
    await sql.doInTransaction(async () => {
        await sql.insert("source_ids", {
            source_id: sourceId,
            date_created: utils.nowDate()
        });
    });

    await refreshSourceIds();
}

function createSourceId() {
    const sourceId = utils.randomString(12);

    log.info("Generated sourceId=" + sourceId);
    return sourceId;
}

async function generateSourceId() {
    const sourceId = createSourceId();

    await saveSourceId(sourceId);

    return sourceId;
}

async function refreshSourceIds() {
    allSourceIds = await sql.getFirstColumn("SELECT source_id FROM source_ids ORDER BY date_created DESC");
}

let allSourceIds = [];

function isLocalSourceId(srcId) {
    return allSourceIds.includes(srcId);
}

const currentSourceId = createSourceId();

// this will also refresh source IDs
sql.dbReady.then(() => saveSourceId(currentSourceId));

function getCurrentSourceId() {
    return currentSourceId;
}

module.exports = {
    generateSourceId,
    getCurrentSourceId,
    isLocalSourceId
};