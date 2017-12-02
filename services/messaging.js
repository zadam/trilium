const WebSocket = require('ws');
const utils = require('./utils');
const log = require('./log');

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
            else {
                log.error('Unrecognized message: ');
                log.error(message);
            }
        });
    });
}

async function sendMessage(message) {
    const jsonStr = JSON.stringify(message);

    webSocketServer.clients.forEach(function each(client) {
        if (client.readyState === WebSocket.OPEN) {
            client.send(jsonStr);
        }
    });
}

module.exports = {
    init,
    sendMessage
};