const WebSocket = require('ws');
const utils = require('./utils');
const log = require('./log');
const sql = require('./sql');

let webSocketServer;

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

            if (message.type === 'log-error') {
                log.error('JS Error: ' + message.error);
            }
            else if (message.type === 'ping') {
                sendPing(ws, message.lastSyncId);
            }
            else {
                log.error('Unrecognized message: ');
                log.error(message);
            }
        });
    });
}

async function sendMessage(client, message) {
    const jsonStr = JSON.stringify(message);

    if (client.readyState === WebSocket.OPEN) {
        client.send(jsonStr);
    }
}

async function sendMessageToAllClients(message) {
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
        if (sync.entityName === 'attributes') {
            sync.noteId = await sql.getValue(`SELECT noteId FROM attributes WHERE attributeId = ?`, [sync.entityId]);
        }
    }

    const stats = require('./sync').stats;

    await sendMessage(client, {
        type: 'sync',
        data: syncData,
        outstandingSyncs: stats.outstandingPushes + stats.outstandingPulls
    });
}

async function refreshTree() {
    await sendMessageToAllClients({ type: 'refresh-tree' });
}

module.exports = {
    init,
    sendMessageToAllClients,
    refreshTree
};