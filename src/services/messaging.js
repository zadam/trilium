const WebSocket = require('ws');
const utils = require('./utils');
const log = require('./log');
const sql = require('./sql');
const optionService = require('./options');
const syncSetup = require('./sync_setup');

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

    log.info("Sending message to all clients: " + jsonStr);

    webSocketServer.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(jsonStr);
        }
    });
}

async function sendPing(client, lastSentSyncId) {
    const syncData = await sql.getRows("SELECT * FROM sync WHERE id > ?", [lastSentSyncId]);

    const lastSyncedPush = await optionService.getOption('last_synced_push');

    const changesToPushCount = await sql.getValue("SELECT COUNT(*) FROM sync WHERE id > ?", [lastSyncedPush]);

    await sendMessage(client, {
        type: 'sync',
        data: syncData,
        changesToPushCount: syncSetup.isSyncSetup ? changesToPushCount : 0
    });
}

module.exports = {
    init,
    sendMessageToAllClients
};