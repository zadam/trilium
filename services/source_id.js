const utils = require('./utils');
const log = require('./log');
const sql = require('./sql');

async function generateSourceId() {
    const sourceId = utils.randomString(12);

    log.info("Generated sourceId=" + sourceId);

    await sql.doInTransaction(async () => {
        await sql.insert("source_ids", {
            source_id: sourceId,
            date_created: utils.nowDate()
        });
    });

    await refreshSourceIds();

    return sourceId;
}

async function refreshSourceIds() {
    allSourceIds = await sql.getFlattenedResults("SELECT source_id FROM source_ids ORDER BY date_created DESC");
}

let allSourceIds = [];

sql.dbReady.then(refreshSourceIds);

function isLocalSourceId(srcId) {
    return allSourceIds.includes(srcId);
}

const currentSourceId = generateSourceId();

module.exports = {
    generateSourceId,
    currentSourceId,
    isLocalSourceId
};