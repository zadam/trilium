import utils from './utils.js';
import toastService from "./toast.js";
import treeService from "./tree.js";

const $outstandingSyncsCount = $("#outstanding-syncs-count");

const allSyncMessageHandlers = [];
const outsideSyncMessageHandlers = [];
const messageHandlers = [];

let ws;
let lastSyncId = window.glob.maxSyncIdAtLoad;
let lastPingTs;
let syncDataQueue = [];

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

function subscribeToOutsideSyncMessages(messageHandler) {
    outsideSyncMessageHandlers.push(messageHandler);
}

function subscribeToAllSyncMessages(messageHandler) {
    allSyncMessageHandlers.push(messageHandler);
}

// used to serialize sync operations
let consumeQueuePromise = null;

async function handleMessage(event) {
    const message = JSON.parse(event.data);

    for (const messageHandler of messageHandlers) {
        messageHandler(message);
    }

    if (message.type === 'sync') {
        lastPingTs = Date.now();

        $outstandingSyncsCount.html(message.outstandingSyncs);

        if (message.data.length > 0) {
            console.debug(utils.now(), "Sync data: ", message.data);

            syncDataQueue.push(...message.data);

            // first wait for all the preceding consumers to finish
            while (consumeQueuePromise) {
                await consumeQueuePromise;
            }

            // it's my turn so start it up
            consumeQueuePromise = consumeSyncData();

            await consumeQueuePromise;

            // finish and set to null to signal somebody else can pick it up
            consumeQueuePromise = null;
        }
    }
    else if (message.type === 'sync-hash-check-failed') {
        toastService.showError("Sync check failed!", 60000);
    }
    else if (message.type === 'consistency-checks-failed') {
        toastService.showError("Consistency checks failed! See logs for details.", 50 * 60000);
    }
}

let syncIdReachedListeners = [];

function waitForSyncId(desiredSyncId) {
    if (desiredSyncId <= lastSyncId) {
        return Promise.resolve();
    }

    return new Promise((res, rej) => {
        syncIdReachedListeners.push({
            desiredSyncId,
            resolvePromise: res,
            start: Date.now()
        })
    });
}

async function consumeSyncData() {
    if (syncDataQueue.length >= 0) {
        const allSyncData = syncDataQueue;
        syncDataQueue = [];

        const outsideSyncData = allSyncData.filter(sync => sync.sourceId !== glob.sourceId);

        // the update process should be synchronous as a whole but individual handlers can run in parallel
        await Promise.all([
            ...allSyncMessageHandlers.map(syncHandler => syncHandler(allSyncData)),
            ...outsideSyncMessageHandlers.map(syncHandler => syncHandler(outsideSyncData))
        ]);

        lastSyncId = allSyncData[allSyncData.length - 1].id;
    }

    syncIdReachedListeners
        .filter(l => l.desiredSyncId <= lastSyncId)
        .forEach(l => l.resolvePromise());

    syncIdReachedListeners = syncIdReachedListeners
        .filter(l => l.desiredSyncId > lastSyncId);

    syncIdReachedListeners.filter(l => Date.now() > l.start - 60000)
        .forEach(l => console.log(`Waiting for syncId ${l.desiredSyncId} for ${Date.now() - l.start}`));
}

function connectWebSocket() {
    const protocol = document.location.protocol === 'https:' ? 'wss' : 'ws';

    // use wss for secure messaging
    const ws = new WebSocket(protocol + "://" + location.host);
    ws.onopen = () => console.debug(utils.now(), "Connected to server with WebSocket");
    ws.onmessage = handleMessage;
    // we're not handling ws.onclose here because reconnection is done in sendPing()

    return ws;
}

setTimeout(() => {
    ws = connectWebSocket();

    lastSyncId = glob.maxSyncIdAtLoad;
    lastPingTs = Date.now();

    setInterval(async () => {
        if (Date.now() - lastPingTs > 30000) {
            console.log(utils.now(), "Lost connection to server");
        }

        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({
                type: 'ping',
                lastSyncId: lastSyncId
            }));
        }
        else if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
            console.log(utils.now(), "WS closed or closing, trying to reconnect");

            ws = connectWebSocket();
        }
    }, 1000);
}, 0);

export default {
    logError,
    subscribeToMessages,
    subscribeToAllSyncMessages,
    subscribeToOutsideSyncMessages,
    waitForSyncId
};