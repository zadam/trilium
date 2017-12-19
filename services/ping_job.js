const sql = require('./sql');
const messaging = require('./messaging');
const options = require('./options');
const sync_setup = require('./sync_setup');

let lastSentSyncId;

async function sendPing() {
    const syncData = await sql.getResults("SELECT * FROM sync WHERE id > ?", [lastSentSyncId]);

    const lastSyncedPush = await options.getOption('last_synced_push');

    const changesToPushCount = await sql.getSingleValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);

    messaging.sendMessage({
        type: 'sync',
        data: syncData,
        changesToPushCount: sync_setup.isSyncSetup ? changesToPushCount : 0
    });

    if (syncData.length > 0) {
        lastSentSyncId = syncData[syncData.length - 1].id;
    }
}

sql.dbReady.then(async () => {
    lastSentSyncId = await sql.getSingleValue("SELECT MAX(id) FROM sync");

    setInterval(sendPing, 1000);
});