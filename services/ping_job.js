const sql = require('./sql');
const source_id = require('./source_id');
const utils = require('./utils');
const messaging = require('./messaging');
const options = require('./options');
const sync_setup = require('./sync_setup');

let startTime = utils.nowDate();
let sentSyncId = [];

async function sendPing() {
    const syncs = await sql.getResults("SELECT * FROM sync WHERE sync_date >= ? AND source_id != ?", [startTime, source_id.currentSourceId]);
    startTime = utils.nowDate();

    const data = {};
    const syncIds = [];

    for (const sync of syncs) {
        if (sentSyncId.includes(sync.id)) {
            continue;
        }

        if (!data[sync.entity_name]) {
            data[sync.entity_name] = [];
        }

        data[sync.entity_name].push(sync.entity_id);
        syncIds.push(sync.id);
    }

    const lastSyncedPush = await options.getOption('last_synced_push');

    const changesToPushCount = await sql.getSingleValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);

    messaging.sendMessage({
        type: 'sync',
        data: data,
        changesToPushCount: sync_setup.isSyncSetup ? changesToPushCount : 0
    });

    for (const syncId of syncIds) {
        sentSyncId.push(syncId);
    }
}

sql.dbReady.then(() => setInterval(sendPing, 1000));