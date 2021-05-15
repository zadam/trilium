const WebSocket = require('ws');
const utils = require('./utils');
const log = require('./log');
const sql = require('./sql');
const cls = require('./cls');
const config = require('./config');
const syncMutexService = require('./sync_mutex');
const protectedSessionService = require('./protected_session');

let webSocketServer;
let lastSyncedPush = null;

function init(httpServer, sessionParser) {
    webSocketServer = new WebSocket.Server({
        verifyClient: (info, done) => {
            sessionParser(info.req, {}, () => {
                const allowed = utils.isElectron()
                    || info.req.session.loggedIn
                    || (config.General && config.General.noAuthentication);

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

        console.log(`websocket client connected`);

        ws.on('message', async messageJson => {
            const message = JSON.parse(messageJson);

            if (message.type === 'log-error') {
                log.info('JS Error: ' + message.error + '\r\nStack: ' + message.stack);
            }
            else if (message.type === 'ping') {
                await syncMutexService.doExclusively(() => sendPing(ws));
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
        if (message.type !== 'sync-failed') {
            log.info("Sending message to all clients: " + jsonStr);
        }

        webSocketServer.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(jsonStr);
            }
        });
    }
}

function fillInAdditionalProperties(entityChange) {
    // fill in some extra data needed by the frontend
    if (entityChange.entityName === 'attributes') {
        entityChange.entity = sql.getRow(`SELECT * FROM attributes WHERE attributeId = ?`, [entityChange.entityId]);
    } else if (entityChange.entityName === 'branches') {
        entityChange.entity = sql.getRow(`SELECT * FROM branches WHERE branchId = ?`, [entityChange.entityId]);
    } else if (entityChange.entityName === 'notes') {
        entityChange.entity = sql.getRow(`SELECT * FROM notes WHERE noteId = ?`, [entityChange.entityId]);

        if (entityChange.entity.isProtected) {
            entityChange.entity.title = protectedSessionService.decryptString(entityChange.entity.title);
        }
    } else if (entityChange.entityName === 'note_revisions') {
        entityChange.noteId = sql.getValue(`SELECT noteId
                                          FROM note_revisions
                                          WHERE noteRevisionId = ?`, [entityChange.entityId]);
    } else if (entityChange.entityName === 'note_reordering') {
        entityChange.positions = sql.getMap(`SELECT branchId, notePosition FROM branches WHERE isDeleted = 0 AND parentNoteId = ?`, [entityChange.entityId]);
    }
    else if (entityChange.entityName === 'options') {
        entityChange.entity = sql.getRow(`SELECT * FROM options WHERE name = ?`, [entityChange.entityId]);
    }
}

function sendPing(client, entityChanges = []) {
    for (const entityChange of entityChanges) {
        try {
            fillInAdditionalProperties(entityChange);
        }
        catch (e) {
            log.error("Could not fill additional properties for entity change " + JSON.stringify(entityChange)
                + " because of error: " + e.message + ": " + e.stack);
        }
    }

    sendMessage(client, {
        type: 'frontend-update',
        data: {
            lastSyncedPush,
            entityChanges
        }
    });
}

function sendTransactionEntityChangesToAllClients() {
    if (webSocketServer) {
        const entityChanges = cls.getAndClearEntityChanges();

        webSocketServer.clients.forEach(client => sendPing(client, entityChanges));
    }
}

function syncPullInProgress() {
    sendMessageToAllClients({ type: 'sync-pull-in-progress', lastSyncedPush });
}

function syncPushInProgress() {
    sendMessageToAllClients({ type: 'sync-push-in-progress', lastSyncedPush });
}

function syncFinished() {
    sendMessageToAllClients({ type: 'sync-finished', lastSyncedPush });
}

function syncFailed() {
    sendMessageToAllClients({ type: 'sync-failed', lastSyncedPush });
}

function setLastSyncedPush(entityChangeId) {
    lastSyncedPush = entityChangeId;
}

module.exports = {
    init,
    sendMessageToAllClients,
    syncPushInProgress,
    syncPullInProgress,
    syncFinished,
    syncFailed,
    sendTransactionEntityChangesToAllClients,
    setLastSyncedPush
};
