import utils from './utils.js';
import toastService from "./toast.js";
import server from "./server.js";
import LoadResults from "./load_results.js";
import Branch from "../entities/branch.js";
import Attribute from "../entities/attribute.js";
import options from "./options.js";
import treeCache from "./tree_cache.js";
import noteAttributeCache from "./note_attribute_cache.js";

const $outstandingSyncsCount = $("#outstanding-syncs-count");

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
            error: message,
            stack: new Error().stack
        }));
    }
}

function subscribeToMessages(messageHandler) {
    messageHandlers.push(messageHandler);
}

// used to serialize sync operations
let consumeQueuePromise = null;

// most sync events are sent twice - once immediatelly after finishing the transaction and once during the scheduled ping
// but we want to process only once
const processedSyncIds = new Set();

function logRows(syncRows) {
    const filteredRows = syncRows.filter(row =>
        !processedSyncIds.has(row.id)
        && row.entityName !== 'recent_notes'
        && (row.entityName !== 'options' || row.entityId !== 'openTabs'));

    if (filteredRows.length > 0) {
        console.debug(utils.now(), "Sync data: ", filteredRows);
    }
}

async function handleMessage(event) {
    const message = JSON.parse(event.data);

    for (const messageHandler of messageHandlers) {
        messageHandler(message);
    }

    if (message.type === 'sync') {
        let syncRows = message.data;
        lastPingTs = Date.now();

        $outstandingSyncsCount.html(message.outstandingSyncs);

        if (syncRows.length > 0) {
            logRows(syncRows);

            syncDataQueue.push(...syncRows);

            // we set lastAcceptedSyncId even before sync processing and send ping so that backend can start sending more updates
            lastAcceptedSyncId = Math.max(lastAcceptedSyncId, syncRows[syncRows.length - 1].id);
            sendPing();

            // first wait for all the preceding consumers to finish
            while (consumeQueuePromise) {
                await consumeQueuePromise;
            }

            try {
                // it's my turn so start it up
                consumeQueuePromise = consumeSyncData();

                await consumeQueuePromise;
            }
            finally {
                // finish and set to null to signal somebody else can pick it up
                consumeQueuePromise = null;
            }
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
    if (desiredSyncId <= lastProcessedSyncId) {
        return Promise.resolve();
    }

    console.debug("Waiting for", desiredSyncId, 'current is', lastProcessedSyncId);

    return new Promise((res, rej) => {
        syncIdReachedListeners.push({
            desiredSyncId,
            resolvePromise: res,
            start: Date.now()
        })
    });
}

function waitForMaxKnownSyncId() {
    return waitForSyncId(server.getMaxKnownSyncId());
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

async function runSafely(syncHandler, syncData) {
    try {
        return await syncHandler(syncData);
    }
    catch (e) {
        console.log(`Sync handler failed with ${e.message}: ${e.stack}`);
    }
}

/**
 * TODO: we should rethink the fact that each sync row is sent twice (once at the end of transaction, once periodically)
 *       and we keep both lastProcessedSyncId and processedSyncIds
 *       it even seems incorrect that when transaction sync rows are received, we incorrectly increase lastProcessedSyncId
 *       and then some syncs might lost (or are *all* sync rows sent from transactions?)
 */
async function consumeSyncData() {
    if (syncDataQueue.length > 0) {
        const allSyncRows = syncDataQueue;
        syncDataQueue = [];

        const nonProcessedSyncRows = allSyncRows.filter(sync => !processedSyncIds.has(sync.id));

        try {
            await utils.timeLimit(processSyncRows(nonProcessedSyncRows), 5000);
        }
        catch (e) {
            logError(`Encountered error ${e.message}: ${e.stack}, reloading frontend.`);

            // if there's an error in updating the frontend then the easy option to recover is to reload the frontend completely
            utils.reloadApp();
        }

        for (const syncRow of nonProcessedSyncRows) {
            processedSyncIds.add(syncRow.id);
        }

        lastProcessedSyncId = Math.max(lastProcessedSyncId, allSyncRows[allSyncRows.length - 1].id);
    }

    checkSyncIdListeners();
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
        console.log(utils.now(), "Lost websocket connection to the backend. If you keep having this issue repeatedly, you might want to check your reverse proxy (nginx, apache) configuration and allow/unblock WebSocket.");
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

async function processSyncRows(syncRows) {
    const missingNoteIds = [];

    for (const {entityName, entity} of syncRows) {
        if (entityName === 'branches' && !(entity.parentNoteId in treeCache.notes)) {
            missingNoteIds.push(entity.parentNoteId);
        }
        else if (entityName === 'attributes'
              && entity.type === 'relation'
              && entity.name === 'template'
              && !(entity.noteId in treeCache.notes)) {

            missingNoteIds.push(entity.value);
        }
    }

    if (missingNoteIds.length > 0) {
        await treeCache.reloadNotes(missingNoteIds);
    }

    const loadResults = new LoadResults(treeCache);

    for (const sync of syncRows.filter(sync => sync.entityName === 'notes')) {
        const note = treeCache.notes[sync.entityId];

        if (note) {
            note.update(sync.entity);
            loadResults.addNote(sync.entityId, sync.sourceId);
        }
    }

    for (const sync of syncRows.filter(sync => sync.entityName === 'branches')) {
        let branch = treeCache.branches[sync.entityId];
        const childNote = treeCache.notes[sync.entity.noteId];
        const parentNote = treeCache.notes[sync.entity.parentNoteId];

        if (branch) {
            branch.update(sync.entity);
            loadResults.addBranch(sync.entityId, sync.sourceId);

            if (sync.entity.isDeleted) {
                if (childNote) {
                    childNote.parents = childNote.parents.filter(parentNoteId => parentNoteId !== sync.entity.parentNoteId);
                    delete childNote.parentToBranch[sync.entity.parentNoteId];
                }

                if (parentNote) {
                    parentNote.children = parentNote.children.filter(childNoteId => childNoteId !== sync.entity.noteId);
                    delete parentNote.childToBranch[sync.entity.noteId];
                }
            }
            else {
                if (childNote) {
                    childNote.addParent(branch.parentNoteId, branch.branchId);
                }

                if (parentNote) {
                    parentNote.addChild(branch.noteId, branch.branchId);
                }
            }
        }
        else if (!sync.entity.isDeleted) {
            if (childNote || parentNote) {
                branch = new Branch(treeCache, sync.entity);
                treeCache.branches[branch.branchId] = branch;

                loadResults.addBranch(sync.entityId, sync.sourceId);

                if (childNote) {
                    childNote.addParent(branch.parentNoteId, branch.branchId);
                }

                if (parentNote) {
                    parentNote.addChild(branch.noteId, branch.branchId);
                }
            }
        }
    }

    for (const sync of syncRows.filter(sync => sync.entityName === 'note_reordering')) {
        for (const branchId in sync.positions) {
            const branch = treeCache.branches[branchId];

            if (branch) {
                branch.notePosition = sync.positions[branchId];
            }
        }

        loadResults.addNoteReordering(sync.entityId, sync.sourceId);
    }

    // missing reloading the relation target note
    for (const sync of syncRows.filter(sync => sync.entityName === 'attributes')) {
        let attribute = treeCache.attributes[sync.entityId];
        const sourceNote = treeCache.notes[sync.entity.noteId];
        const targetNote = sync.entity.type === 'relation' && treeCache.notes[sync.entity.value];

        if (attribute) {
            attribute.update(sync.entity);
            loadResults.addAttribute(sync.entityId, sync.sourceId);

            if (sync.entity.isDeleted) {
                if (sourceNote) {
                    sourceNote.attributes = sourceNote.attributes.filter(attributeId => attributeId !== attribute.attributeId);
                }

                if (targetNote) {
                    targetNote.targetRelations = targetNote.targetRelations.filter(attributeId => attributeId !== attribute.attributeId);
                }
            }
        }
        else if (!sync.entity.isDeleted) {
            if (sourceNote || targetNote) {
                attribute = new Attribute(treeCache, sync.entity);

                treeCache.attributes[attribute.attributeId] = attribute;

                loadResults.addAttribute(sync.entityId, sync.sourceId);

                if (sourceNote && !sourceNote.attributes.includes(attribute.attributeId)) {
                    sourceNote.attributes.push(attribute.attributeId);
                }

                if (targetNote && !targetNote.targetRelations.includes(attribute.attributeId)) {
                    targetNote.targetRelations.push(attribute.attributeId);
                }
            }
        }
    }

    for (const sync of syncRows.filter(sync => sync.entityName === 'note_contents')) {
        delete treeCache.noteComplementPromises[sync.entityId];

        loadResults.addNoteContent(sync.entityId, sync.sourceId);
    }

    for (const sync of syncRows.filter(sync => sync.entityName === 'note_revisions')) {
        loadResults.addNoteRevision(sync.entityId, sync.noteId, sync.sourceId);
    }

    for (const sync of syncRows.filter(sync => sync.entityName === 'options')) {
        if (sync.entity.name === 'openTabs') {
            continue; // only noise
        }

        options.set(sync.entity.name, sync.entity.value);

        loadResults.addOption(sync.entity.name);
    }

    if (!loadResults.isEmpty()) {
        if (loadResults.hasAttributeRelatedChanges()) {
            noteAttributeCache.invalidate();
        }

        const appContext = (await import("./app_context.js")).default;
        await appContext.triggerEvent('entitiesReloaded', {loadResults});
    }
}

export default {
    logError,
    subscribeToMessages,
    waitForSyncId,
    waitForMaxKnownSyncId
};
