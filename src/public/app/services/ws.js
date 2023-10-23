import utils from './utils.js';
import toastService from "./toast.js";
import server from "./server.js";
import options from "./options.js";
import frocaUpdater from "./froca_updater.js";
import appContext from "../components/app_context.js";

const messageHandlers = [];

let ws;
let lastAcceptedEntityChangeId = window.glob.maxEntityChangeIdAtLoad;
let lastAcceptedEntityChangeSyncId = window.glob.maxEntityChangeSyncIdAtLoad;
let lastProcessedEntityChangeId = window.glob.maxEntityChangeIdAtLoad;
let lastPingTs;
let frontendUpdateDataQueue = [];

function logError(message) {
    console.error(utils.now(), message); // needs to be separate from .trace()

    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
            type: 'log-error',
            error: message,
            stack: new Error().stack
        }));
    }
}

function logInfo(message) {
    console.log(utils.now(), message);

    if (ws && ws.readyState === 1) {
        ws.send(JSON.stringify({
            type: 'log-info',
            info: message
        }));
    }
}

window.logError = logError;
window.logInfo = logInfo;

function subscribeToMessages(messageHandler) {
    messageHandlers.push(messageHandler);
}

// used to serialize frontend update operations
let consumeQueuePromise = null;

// to make sure each change event is processed only once. Not clear if this is still necessary
const processedEntityChangeIds = new Set();

function logRows(entityChanges) {
    const filteredRows = entityChanges.filter(row =>
        !processedEntityChangeIds.has(row.id)
        && (row.entityName !== 'options' || row.entityId !== 'openNoteContexts'));

    if (filteredRows.length > 0) {
        console.debug(utils.now(), "Frontend update data: ", filteredRows);
    }
}

async function executeFrontendUpdate(entityChanges) {
    lastPingTs = Date.now();

    if (entityChanges.length > 0) {
        logRows(entityChanges);

        frontendUpdateDataQueue.push(...entityChanges);

        // we set lastAcceptedEntityChangeId even before frontend update processing and send ping so that backend can start sending more updates

        for (const entityChange of entityChanges) {
            lastAcceptedEntityChangeId = Math.max(lastAcceptedEntityChangeId, entityChange.id);

            if (entityChange.isSynced) {
                lastAcceptedEntityChangeSyncId = Math.max(lastAcceptedEntityChangeSyncId, entityChange.id);
            }
        }

        sendPing();

        // first wait for all the preceding consumers to finish
        while (consumeQueuePromise) {
            await consumeQueuePromise;
        }

        try {
            // it's my turn, so start it up
            consumeQueuePromise = consumeFrontendUpdateData();

            await consumeQueuePromise;
        } finally {
            // finish and set to null to signal somebody else can pick it up
            consumeQueuePromise = null;
        }
    }
}

async function handleMessage(event) {
    const message = JSON.parse(event.data);

    for (const messageHandler of messageHandlers) {
        messageHandler(message);
    }

    if (message.type === 'ping') {
        lastPingTs = Date.now();
    }
    else if (message.type === 'reload-frontend') {
        utils.reloadFrontendApp("received request from backend to reload frontend");
    }
    else if (message.type === 'frontend-update') {
        await executeFrontendUpdate(message.data.entityChanges);
    }
    else if (message.type === 'sync-hash-check-failed') {
        toastService.showError("Sync check failed!", 60000);
    }
    else if (message.type === 'consistency-checks-failed') {
        toastService.showError("Consistency checks failed! See logs for details.", 50 * 60000);
    }
    else if (message.type === 'api-log-messages') {
        appContext.triggerEvent("apiLogMessages", {noteId: message.noteId, messages: message.messages});
    }
    else if (message.type === 'toast') {
        toastService.showMessage(message.message);
    }
    else if (message.type === 'execute-script') {
        const bundleService = (await import("../services/bundle.js")).default;
        const froca = (await import("../services/froca.js")).default;
        const originEntity = message.originEntityId ? await froca.getNote(message.originEntityId) : null;

        bundleService.getAndExecuteBundle(message.currentNoteId, originEntity, message.script, message.params);
    }
}

let entityChangeIdReachedListeners = [];

function waitForEntityChangeId(desiredEntityChangeId) {
    if (desiredEntityChangeId <= lastProcessedEntityChangeId) {
        return Promise.resolve();
    }

    console.debug(`Waiting for ${desiredEntityChangeId}, last processed is ${lastProcessedEntityChangeId}, last accepted ${lastAcceptedEntityChangeId}`);

    return new Promise((res, rej) => {
        entityChangeIdReachedListeners.push({
            desiredEntityChangeId: desiredEntityChangeId,
            resolvePromise: res,
            start: Date.now()
        })
    });
}

function waitForMaxKnownEntityChangeId() {
    return waitForEntityChangeId(server.getMaxKnownEntityChangeId());
}

function checkEntityChangeIdListeners() {
    entityChangeIdReachedListeners
        .filter(l => l.desiredEntityChangeId <= lastProcessedEntityChangeId)
        .forEach(l => l.resolvePromise());

    entityChangeIdReachedListeners = entityChangeIdReachedListeners
        .filter(l => l.desiredEntityChangeId > lastProcessedEntityChangeId);

    entityChangeIdReachedListeners.filter(l => Date.now() > l.start - 60000)
        .forEach(l => console.log(`Waiting for entityChangeId ${l.desiredEntityChangeId} while last processed is ${lastProcessedEntityChangeId} (last accepted ${lastAcceptedEntityChangeId}) for ${Math.floor((Date.now() - l.start) / 1000)}s`));
}

async function consumeFrontendUpdateData() {
    if (frontendUpdateDataQueue.length > 0) {
        const allEntityChanges = frontendUpdateDataQueue;
        frontendUpdateDataQueue = [];

        const nonProcessedEntityChanges = allEntityChanges.filter(ec => !processedEntityChangeIds.has(ec.id));

        try {
            await utils.timeLimit(frocaUpdater.processEntityChanges(nonProcessedEntityChanges), 30000);
        }
        catch (e) {
            logError(`Encountered error ${e.message}: ${e.stack}, reloading frontend.`);

            if (!glob.isDev && !options.is('debugModeEnabled')) {
                // if there's an error in updating the frontend, then the easy option to recover is to reload the frontend completely

                utils.reloadFrontendApp();
            }
            else {
                console.log("nonProcessedEntityChanges causing the timeout", nonProcessedEntityChanges);

                toastService.showError(`Encountered error "${e.message}", check out the console.`);
            }
        }

        for (const entityChange of nonProcessedEntityChanges) {
            processedEntityChangeIds.add(entityChange.id);

            lastProcessedEntityChangeId = Math.max(lastProcessedEntityChangeId, entityChange.id);
        }
    }

    checkEntityChangeIdListeners();
}

function connectWebSocket() {
    const loc = window.location;
    const webSocketUri = `${loc.protocol === "https:" ? "wss:" : "ws:"}//${loc.host}${loc.pathname}`;

    // use wss for secure messaging
    const ws = new WebSocket(webSocketUri);
    ws.onopen = () => console.debug(utils.now(), `Connected to server ${webSocketUri} with WebSocket`);
    ws.onmessage = handleMessage;
    // we're not handling ws.onclose here because reconnection is done in sendPing()

    return ws;
}

async function sendPing() {
    if (Date.now() - lastPingTs > 30000) {
        console.log(utils.now(), "Lost websocket connection to the backend. If you keep having this issue repeatedly, you might want to check your reverse proxy (nginx, apache) configuration and allow/unblock WebSocket.");
    }

    if (ws.readyState === ws.OPEN) {
        ws.send(JSON.stringify({
            type: 'ping',
            lastEntityChangeId: lastAcceptedEntityChangeId
        }));
    }
    else if (ws.readyState === ws.CLOSED || ws.readyState === ws.CLOSING) {
        console.log(utils.now(), "WS closed or closing, trying to reconnect");

        ws = connectWebSocket();
    }
}

setTimeout(() => {
    ws = connectWebSocket();

    lastPingTs = Date.now();

    setInterval(sendPing, 1000);
}, 0);

export default {
    logError,
    subscribeToMessages,
    waitForMaxKnownEntityChangeId,
    getMaxKnownEntityChangeSyncId: () => lastAcceptedEntityChangeSyncId
};
