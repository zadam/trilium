const WebSocket = require('ws');
const utils = require('./utils');
const log = require('./log');
const sql = require('./sql');
const cls = require('./cls');
const syncMutexService = require('./sync_mutex');
const protectedSessionService = require('./protected_session');

let webSocketServer;
let lastAcceptedSyncIds = {};

function init(httpServer, sessionParser) {
    webSocketServer = new WebSocket.Server({
        verifyClient: (info, done) => {
            sessionParser(info.req, {}, () => {
                const allowed = utils.isElectron() || info.req.session.loggedIn;

                if (!allowed) {
                    log.error("WebSocket connection not allowed because session is neither electron nor logged in.");
                }

                done(allowed)
            });
        },
        server: httpServer
    });

    webSocketServer.on('connection', (ws, req) => {
        ws.id = utils.randomString(10);

        lastAcceptedSyncIds[ws.id] = 0;

        console.log(`websocket client connected`);

        ws.on('message', messageJson => {
            const message = JSON.parse(messageJson);

            if (message.type === 'log-error') {
                log.info('JS Error: ' + message.error + '\r\nStack: ' + message.stack);
            }
            else if (message.type === 'ping') {
                lastAcceptedSyncIds[ws.id] = message.lastSyncId;

                syncMutexService.doExclusively(async () => await sendPing(ws));
            }
            else {
                log.error('Unrecognized message: ');
                log.error(message);
            }
        });
    });
}

function sendMessage(client, message) {
    const jsonStr = JSON.stringify(message);

    if (client.readyState === WebSocket.OPEN) {
        client.send(jsonStr);
    }
}

function sendMessageToAllClients(message) {
    const jsonStr = JSON.stringify(message);

    if (webSocketServer) {
        log.info("Sending message to all clients: " + jsonStr);

        webSocketServer.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(jsonStr);
            }
        });
    }
}

async function fillInAdditionalProperties(sync) {
    // fill in some extra data needed by the frontend
    if (sync.entityName === 'attributes') {
        sync.entity = await sql.getRow(`SELECT * FROM attributes WHERE attributeId = ?`, [sync.entityId]);
    } else if (sync.entityName === 'branches') {
        sync.entity = await sql.getRow(`SELECT * FROM branches WHERE branchId = ?`, [sync.entityId]);
    } else if (sync.entityName === 'notes') {
        sync.entity = await sql.getRow(`SELECT * FROM notes WHERE noteId = ?`, [sync.entityId]);

        if (sync.entity.isProtected) {
            sync.entity.title = protectedSessionService.decryptString(sync.entity.title);
        }
    } else if (sync.entityName === 'note_revisions') {
        sync.noteId = await sql.getValue(`SELECT noteId
                                          FROM note_revisions
                                          WHERE noteRevisionId = ?`, [sync.entityId]);
    } else if (sync.entityName === 'note_reordering') {
        sync.positions = await sql.getMap(`SELECT branchId, notePosition FROM branches WHERE isDeleted = 0 AND parentNoteId = ?`, [sync.entityId]);
    }
    else if (sync.entityName === 'options') {
        sync.entity = await sql.getRow(`SELECT * FROM options WHERE name = ?`, [sync.entityId]);
    }
}

async function sendPing(client) {
    const syncRows = cls.getSyncRows();

    for (const sync of syncRows) {
        try {
            await fillInAdditionalProperties(sync);
        }
        catch (e) {
            log.error("Could not fill additional properties for sync " + JSON.stringify(sync)
                + " because of error: " + e.message + ": " + e.stack);
        }
    }

    const stats = require('./sync').stats;

    sendMessage(client, {
        type: 'sync',
        data: syncRows,
        outstandingSyncs: stats.outstandingPushes + stats.outstandingPulls
    });
}

function sendPingToAllClients() {
    if (webSocketServer) {
        webSocketServer.clients.forEach(function each(client) {
           sendPing(client);
        });
    }
}

function syncPullInProgress() {
    sendMessageToAllClients({ type: 'sync-pull-in-progress' });
}

function syncPullFinished() {
    sendMessageToAllClients({ type: 'sync-pull-finished' });
}

module.exports = {
    init,
    sendMessageToAllClients,
    syncPullInProgress,
    syncPullFinished,
    sendPingToAllClients
};
