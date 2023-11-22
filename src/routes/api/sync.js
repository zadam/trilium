"use strict";

const syncService = require('../../services/sync.js');
const syncUpdateService = require('../../services/sync_update.js');
const entityChangesService = require('../../services/entity_changes.js');
const sql = require('../../services/sql.js');
const sqlInit = require('../../services/sql_init.js');
const optionService = require('../../services/options.js');
const contentHashService = require('../../services/content_hash.js');
const log = require('../../services/log.js');
const syncOptions = require('../../services/sync_options.js');
const utils = require('../../services/utils.js');
const ws = require('../../services/ws.js');

async function testSync() {
    try {
        if (!syncOptions.isSyncSetup()) {
            return { success: false, message: "Sync server host is not configured. Please configure sync first." };
        }

        await syncService.login();

        // login was successful, so we'll kick off sync now
        // this is important in case when sync server has been just initialized
        syncService.sync();

        return { success: true, message: "Sync server handshake has been successful, sync has been started." };
    }
    catch (e) {
        return {
            success: false,
            message: e.message
        };
    }
}

function getStats() {
    if (!sqlInit.schemaExists()) {
        // fail silently but prevent errors from not existing options table
        return {};
    }

    const stats = {
        initialized: sql.getValue("SELECT value FROM options WHERE name = 'initialized'") === 'true',
        outstandingPullCount: syncService.getOutstandingPullCount()
    };

    log.info(`Returning sync stats: ${JSON.stringify(stats)}`);

    return stats;
}

function checkSync() {
    return {
        entityHashes: contentHashService.getEntityHashes(),
        maxEntityChangeId: sql.getValue('SELECT COALESCE(MAX(id), 0) FROM entity_changes WHERE isSynced = 1')
    };
}

function syncNow() {
    log.info("Received request to trigger sync now.");

    // when explicitly asked for set in progress status immediately for faster user feedback
    ws.syncPullInProgress();

    return syncService.sync();
}

function fillEntityChanges() {
    entityChangesService.fillAllEntityChanges();

    log.info("Sync rows have been filled.");
}

function forceFullSync() {
    optionService.setOption('lastSyncedPull', 0);
    optionService.setOption('lastSyncedPush', 0);

    log.info("Forcing full sync.");

    // not awaiting for the job to finish (will probably take a long time)
    syncService.sync();
}

function getChanged(req) {
    const startTime = Date.now();

    let lastEntityChangeId = parseInt(req.query.lastEntityChangeId);
    const clientInstanceId = req.query.instanceId;
    let filteredEntityChanges = [];

    do {
        const entityChanges = sql.getRows(`
            SELECT *
            FROM entity_changes
            WHERE isSynced = 1
              AND id > ?
            ORDER BY id
            LIMIT 1000`, [lastEntityChangeId]);

        if (entityChanges.length === 0) {
            break;
        }

        filteredEntityChanges = entityChanges.filter(ec => ec.instanceId !== clientInstanceId);

        if (filteredEntityChanges.length === 0) {
            lastEntityChangeId = entityChanges[entityChanges.length - 1].id;
        }
    } while (filteredEntityChanges.length === 0);

    const entityChangeRecords = syncService.getEntityChangeRecords(filteredEntityChanges);

    if (entityChangeRecords.length > 0) {
        lastEntityChangeId = entityChangeRecords[entityChangeRecords.length - 1].entityChange.id;

        log.info(`Returning ${entityChangeRecords.length} entity changes in ${Date.now() - startTime}ms`);
    }

    return {
        entityChanges: entityChangeRecords,
        lastEntityChangeId,
        outstandingPullCount: sql.getValue(`
            SELECT COUNT(id) 
            FROM entity_changes 
            WHERE isSynced = 1 
              AND instanceId != ?
              AND id > ?`, [clientInstanceId, lastEntityChangeId])
    };
}

const partialRequests = {};

function update(req) {
    let {body} = req;

    const pageCount = parseInt(req.get('pageCount'));
    const pageIndex = parseInt(req.get('pageIndex'));

    if (pageCount !== 1) {
        const requestId = req.get('requestId');

        if (pageIndex === 0) {
            partialRequests[requestId] = {
                createdAt: Date.now(),
                payload: ''
            };
        }

        if (!partialRequests[requestId]) {
            throw new Error(`Partial request ${requestId}, page ${pageIndex + 1} of ${pageCount} of pages does not have expected record.`);
        }

        partialRequests[requestId].payload += req.body;

        log.info(`Receiving a partial request ${requestId}, page ${pageIndex + 1} out of ${pageCount} pages.`);

        if (pageIndex !== pageCount - 1) {
            return;
        }
        else {
            body = JSON.parse(partialRequests[requestId].payload);
            delete partialRequests[requestId];
        }
    }

    const {entities, instanceId} = body;

    sql.transactional(() => syncUpdateService.updateEntities(entities, instanceId));
}

setInterval(() => {
    for (const key in partialRequests) {
        if (Date.now() - partialRequests[key].createdAt > 20 * 60 * 1000) {
            log.info(`Cleaning up unfinished partial requests for ${key}`);

            delete partialRequests[key];
        }
    }
}, 60 * 1000);

function syncFinished() {
    // after the first sync finishes, the application is ready to be used
    // this is meaningless but at the same time harmless (idempotent) for further syncs
    sqlInit.setDbAsInitialized();
}

function queueSector(req) {
    const entityName = utils.sanitizeSqlIdentifier(req.params.entityName);
    const sector = utils.sanitizeSqlIdentifier(req.params.sector);

    entityChangesService.addEntityChangesForSector(entityName, sector);
}

function checkEntityChanges() {
    require('../../services/consistency_checks.js').runEntityChangesChecks();
}

module.exports = {
    testSync,
    checkSync,
    syncNow,
    fillEntityChanges,
    forceFullSync,
    getChanged,
    update,
    getStats,
    syncFinished,
    queueSector,
    checkEntityChanges
};
