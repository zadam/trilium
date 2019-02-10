import utils from './utils.js';
import infoService from "./info.js";

const $outstandingSyncsCount = $("#outstanding-syncs-count");

const syncMessageHandlers = [];
const messageHandlers = [];

let ws;
let lastSyncId;
let lastPingTs;

function logError(message) {
    console.log(utils.now(), message); // needs to be separate from .trace()
    console.trace();

    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
            type: 'log-error',
            error: message
        }));
    }
}

function subscribeToMessages(messageHandler) {
    messageHandlers.push(messageHandler);
}

function subscribeToSyncMessages(messageHandler) {
    syncMessageHandlers.push(messageHandler);
}

function handleMessage(event) {
    const message = JSON.parse(event.data);

    for (const messageHandler of messageHandlers) {
        messageHandler(message);
    }

    if (message.type === 'sync') {
        lastPingTs = Date.now();

        if (message.data.length > 0) {
            console.debug(utils.now(), "Sync data: ", message.data);

            lastSyncId = message.data[message.data.length - 1].id;
        }

        const syncData = message.data.filter(sync => sync.sourceId !== glob.sourceId);

        for (const syncMessageHandler of syncMessageHandlers) {
            syncMessageHandler(syncData);
        }

        $outstandingSyncsCount.html(message.outstandingSyncs);
    }
    else if (message.type === 'sync-hash-check-failed') {
        infoService.showError("Sync check failed!", 60000);
    }
    else if (message.type === 'consistency-checks-failed') {
        infoService.showError("Consistency checks failed! See logs for details.", 50 * 60000);
    }
}

function connectWebSocket() {
    const protocol = document.location.protocol === 'https:' ? 'wss' : 'ws';

    // use wss for secure messaging
    const ws = new WebSocket(protocol + "://" + location.host);
    ws.onopen = event => console.debug(utils.now(), "Connected to server with WebSocket");
    ws.onmessage = handleMessage;
    ws.onclose = function(){
        // Try to reconnect in 5 seconds
        setTimeout(() => connectWebSocket(), 5000);
    };

    return ws;
}

setTimeout(() => {
    ws = connectWebSocket();

    lastSyncId = glob.maxSyncIdAtLoad;
    lastPingTs = Date.now();

    setInterval(async () => {
        if (Date.now() - lastPingTs > 30000) {
            console.log("Lost connection to server");
        }

        ws.send(JSON.stringify({
            type: 'ping',
            lastSyncId: lastSyncId
        }));
    }, 1000);
}, 0);

export default {
    logError,
    subscribeToMessages,
    subscribeToSyncMessages
};