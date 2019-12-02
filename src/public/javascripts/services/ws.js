import utils from './utils.js';
import toastService from "./toast.js";

const $outstandingSyncsCount = $("#outstanding-syncs-count");

const allSyncMessageHandlers = [];
const outsideSyncMessageHandlers = [];
const messageHandlers = [];

let ws;
let lastAcceptedSyncId = window.glob.maxSyncIdAtLoad;
let lastProcessedSyncId = window.glob.maxSyncIdAtLoad;
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
        const syncRows = message.data;
        lastPingTs = Date.now();

        $outstandingSyncsCount.html(message.outstandingSyncs);

        if (syncRows.length > 0) {
            console.debug(utils.now(), "Sync data: ", syncRows);

            syncDataQueue.push(...syncRows);

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

        checkSyncIdListeners();
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
    if (desiredSyncId <= lastProcessedSyncId) {
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

function checkSyncIdListeners() {
    syncIdReachedListeners
        .filter(l => l.desiredSyncId <= lastProcessedSyncId)
        .forEach(l => l.resolvePromise());

    syncIdReachedListeners = syncIdReachedListeners
        .filter(l => l.desiredSyncId > lastProcessedSyncId);

    syncIdReachedListeners.filter(l => Date.now() > l.start - 60000)
        .forEach(l => console.log(`Waiting for syncId ${l.desiredSyncId} while current is ${lastProcessedSyncId} for ${Math.floor((Date.now() - l.start) / 1000)}s`));
}

async function consumeSyncData() {
    if (syncDataQueue.length > 0) {
        const allSyncData = syncDataQueue;
        syncDataQueue = [];

        const outsideSyncData = allSyncData.filter(sync => sync.sourceId !== glob.sourceId);

        // we set lastAcceptedSyncId even before sync processing and send ping so that backend can start sending more updates
        lastAcceptedSyncId = Math.max(lastAcceptedSyncId, allSyncData[allSyncData.length - 1].id);
        sendPing();

        // the update process should be synchronous as a whole but individual handlers can run in parallel
        await Promise.all([
            ...allSyncMessageHandlers.map(syncHandler => syncHandler(allSyncData)),
            ...outsideSyncMessageHandlers.map(syncHandler => syncHandler(outsideSyncData))
        ]);

        lastProcessedSyncId = Math.max(lastProcessedSyncId, allSyncData[allSyncData.length - 1].id);
    }
}

function connectWebSocket() {
    const loc = window.location;
    const webSocketUri = (loc.protocol === "https:" ? "wss:" : "ws:")
                       + "//" + loc.host + loc.pathname;

    // use wss for secure messaging
    const ws = new WebSocket(webSocketUri);
    ws.onopen = () => console.debug(utils.now(), `Connected to server ${webSocketUri} with WebSocket`);
    ws.onmessage = handleMessage;
    // we're not handling ws.onclose here because reconnection is done in sendPing()

    return ws;
}

async function sendPing() {
    if (Date.now() - lastPingTs > 30000) {
        console.log(utils.now(), "Lost connection to server");
    }

    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
            type: 'ping',
            lastSyncId: lastAcceptedSyncId
        }));
    }
    else if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
        console.log(utils.now(), "WS closed or closing, trying to reconnect");

        ws = connectWebSocket();
    }
}

setTimeout(() => {
    ws = connectWebSocket();

    lastAcceptedSyncId = glob.maxSyncIdAtLoad;
    lastProcessedSyncId = glob.maxSyncIdAtLoad;
    lastPingTs = Date.now();

    setInterval(sendPing, 1000);
}, 0);

subscribeToMessages(message => {
    if (message.type === 'sync-pull-in-progress') {
        toastService.showPersistent({
            id: 'sync',
            title: "Sync status",
            message: "Sync update in progress",
            icon: "refresh"
        });
    }
    else if (message.type === 'sync-pull-finished') {
        // this gives user a chance to see the toast in case of fast sync finish
        setTimeout(() => toastService.closePersistent('sync'), 1000);
    }
});

export default {
    logError,
    subscribeToMessages,
    subscribeToAllSyncMessages,
    subscribeToOutsideSyncMessages,
    waitForSyncId
};