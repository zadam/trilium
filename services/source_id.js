const utils = require('./utils');
const log = require('./log');
const sql = require('./sql');

const currentSourceId = utils.randomString(12);

log.info("Using sourceId=" + currentSourceId);

let allSourceIds = [];

sql.dbReady.then(async () => {
    try {
        await sql.doInTransaction(async () => {
            await sql.insert("source_ids", {
                source_id: currentSourceId,
                date_created: utils.nowTimestamp()
            });
        });

        allSourceIds = await sql.getFlattenedResults("source_id", "SELECT source_id FROM source_ids");
    }
    catch (e) {}
});

function isLocalSourceId(srcId) {
    return allSourceIds.includes(srcId);
}

module.exports = {
    currentSourceId,
    isLocalSourceId
};