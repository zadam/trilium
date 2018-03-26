import utils from './utils.js';

const $changesToPushCount = $("#changes-to-push-count");

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

function handleMessage(event) {
    const message = JSON.parse(event.data);

    if (message.type === 'sync') {
        lastPingTs = new Date().getTime();

        if (message.data.length > 0) {
            console.log(utils.now(), "Sync data: ", message.data);

            lastSyncId = message.data[message.data.length - 1].id;
        }

        const syncData = message.data.filter(sync => sync.sourceId !== glob.sourceId);

        for (const messageHandler of messageHandlers) {
            messageHandler(syncData);
        }

        $changesToPushCount.html(message.changesToPushCount);
    }
    else if (message.type === 'sync-hash-check-failed') {
        utils.utils.showError("Sync check failed!", 60000);
    }
    else if (message.type === 'consistency-checks-failed') {
        utils.showError("Consistency checks failed! See logs for details.", 50 * 60000);
    }
}

function connectWebSocket() {
    const protocol = document.location.protocol === 'https:' ? 'wss' : 'ws';

    // use wss for secure messaging
    const ws = new WebSocket(protocol + "://" + location.host);
    ws.onopen = event => console.log(utils.now(), "Connected to server with WebSocket");
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
    lastPingTs = new Date().getTime();
    let connectionBrokenNotification = null;

    setInterval(async () => {
        if (new Date().getTime() - lastPingTs > 30000) {
            if (!connectionBrokenNotification) {
                connectionBrokenNotification = $.notify({
                    // options
                    message: "Lost connection to server"
                },{
                    // settings
                    type: 'danger',
                    delay: 100000000 // keep it until we explicitly close it
                });
            }
        }
        else if (connectionBrokenNotification) {
            await connectionBrokenNotification.close();
            connectionBrokenNotification = null;

            utils.showMessage("Re-connected to server");
        }

        ws.send(JSON.stringify({
            type: 'ping',
            lastSyncId: lastSyncId
        }));
    }, 1000);
}, 1000);

export default {
    logError,
    subscribeToMessages
};