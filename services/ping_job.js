const sql = require('./sql');
const utils = require('./utils');
const messaging = require('./messaging');
const options = require('./options');
const sync_setup = require('./sync_setup');

let startTime = utils.nowDate();
let sentSyncId = [];

async function sendPing() {
    const syncs = await sql.getResults("SELECT * FROM sync WHERE sync_date >= ?", [startTime]);
    startTime = utils.nowDate();

    const syncData = syncs.filter(sync => !sentSyncId.includes(sync.id));

    const lastSyncedPush = await options.getOption('last_synced_push');

    const changesToPushCount = await sql.getSingleValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);

    messaging.sendMessage({
        type: 'sync',
        data: syncData,
        changesToPushCount: sync_setup.isSyncSetup ? changesToPushCount : 0
    });

    for (const sync of syncData) {
        sentSyncId.push(sync.id);
    }
}

sql.dbReady.then(() => setInterval(sendPing, 1000));