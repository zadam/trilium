const WebSocket = require('ws');

let webSocketServer;

function init(httpServer) {
    webSocketServer = new WebSocket.Server({server: httpServer});
    webSocketServer.on('connection', function connection(ws, req) {
        console.log("websocket client connected");
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