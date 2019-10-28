const WebSocket = require('ws');
const utils = require('./utils');
const log = require('./log');
const sql = require('./sql');
const syncMutexService = require('./sync_mutex');

let webSocketServer;
let lastSyncId = 0;

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
        console.log("websocket client connected");

        ws.on('message', messageJson => {
            const message = JSON.parse(messageJson);

            lastSyncId = Math.max(lastSyncId, message.lastSyncId);

            if (message.type === 'log-error') {
                log.error('JS Error: ' + message.error);
            }
            else if (message.type === 'ping') {
                syncMutexService.doExclusively(async () => await sendPing(ws, lastSyncId));
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

async function sendPing(client, lastSentSyncId) {
    const syncData = await sql.getRows("SELECT * FROM sync WHERE id > ?", [lastSentSyncId]);

    for (const sync of syncData) {
        // fill in some extra data needed by the frontend
        if (sync.entityName === 'attributes') {
            sync.noteId = await sql.getValue(`SELECT noteId FROM attributes WHERE attributeId = ?`, [sync.entityId]);
        }
        else if (sync.entityName === 'note_revisions') {
            sync.noteId = await sql.getValue(`SELECT noteId FROM note_revisions WHERE noteRevisionId = ?`, [sync.entityId]);
        }
        else if (sync.entityName === 'branches') {
            const {noteId, parentNoteId} = await sql.getRow(`SELECT noteId, parentNoteId FROM branches WHERE branchId = ?`, [sync.entityId]);

            sync.noteId = noteId;
            sync.parentNoteId = parentNoteId;
        }
    }

    const stats = require('./sync').stats;

    sendMessage(client, {
        type: 'sync',
        data: syncData,
        outstandingSyncs: stats.outstandingPushes + stats.outstandingPulls
    });
}

function refreshTree() {
    sendMessageToAllClients({ type: 'refresh-tree' });
}

function syncPullInProgress() {
    sendMessageToAllClients({ type: 'sync-pull-in-progress' });
}

async function syncPullFinished() {
    sendMessageToAllClients({ type: 'sync-pull-finished' });
}

module.exports = {
    init,
    sendMessageToAllClients,
    refreshTree,
    syncPullInProgress,
    syncPullFinished
};