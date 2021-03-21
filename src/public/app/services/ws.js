import utils from './utils.js';
import toastService from "./toast.js";
import server from "./server.js";
import LoadResults from "./load_results.js";
import Branch from "../entities/branch.js";
import Attribute from "../entities/attribute.js";
import options from "./options.js";
import treeCache from "./tree_cache.js";
import noteAttributeCache from "./note_attribute_cache.js";

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

window.logError = logError;

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
        && (row.entityName !== 'options' || row.entityId !== 'openTabs'));

    if (filteredRows.length > 0) {
        console.debug(utils.now(), "Frontend update data: ", filteredRows);
    }
}

async function handleMessage(event) {
    const message = JSON.parse(event.data);

    for (const messageHandler of messageHandlers) {
        messageHandler(message);
    }

    if (message.type === 'frontend-update') {
        let {entityChanges, lastSyncedPush} = message.data;
        lastPingTs = Date.now();

        if (entityChanges.length > 0) {
            logRows(entityChanges);

            frontendUpdateDataQueue.push(...entityChanges);

            // we set lastAcceptedEntityChangeId even before frontend update processing and send ping so that backend can start sending more updates
            lastAcceptedEntityChangeId = Math.max(lastAcceptedEntityChangeId, entityChanges[entityChanges.length - 1].id);

            const lastSyncEntityChange = entityChanges.slice().reverse().find(ec => ec.isSynced);

            if (lastSyncEntityChange) {
                lastAcceptedEntityChangeSyncId = Math.max(lastAcceptedEntityChangeSyncId, lastSyncEntityChange.id);
            }

            sendPing();

            // first wait for all the preceding consumers to finish
            while (consumeQueuePromise) {
                await consumeQueuePromise;
            }

            try {
                // it's my turn so start it up
                consumeQueuePromise = consumeFrontendUpdateData();

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
            await utils.timeLimit(processEntityChanges(nonProcessedEntityChanges), 30000);
        }
        catch (e) {
            logError(`Encountered error ${e.message}: ${e.stack}, reloading frontend.`);

            if (!glob.isDev && !options.is('debugModeEnabled')) {
                // if there's an error in updating the frontend then the easy option to recover is to reload the frontend completely

                utils.reloadApp();
            }
            else {
                console.log("nonProcessedEntityChanges causing the timeout", nonProcessedEntityChanges);

                alert(`Encountered error "${e.message}", check out the console.`);
            }
        }

        for (const entityChange of nonProcessedEntityChanges) {
            processedEntityChangeIds.add(entityChange.id);
        }

        lastProcessedEntityChangeId = Math.max(lastProcessedEntityChangeId, allEntityChanges[allEntityChanges.length - 1].id);
    }

    checkEntityChangeIdListeners();
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

async function processEntityChanges(entityChanges) {
    const loadResults = new LoadResults(treeCache);

    for (const ec of entityChanges.filter(ec => ec.entityName === 'notes')) {
        const note = treeCache.notes[ec.entityId];

        if (note) {
            note.update(ec.entity);
            loadResults.addNote(ec.entityId, ec.sourceId);
        }
    }

    for (const ec of entityChanges.filter(ec => ec.entityName === 'branches')) {
        let branch = treeCache.branches[ec.entityId];
        const childNote = treeCache.notes[ec.entity.noteId];
        const parentNote = treeCache.notes[ec.entity.parentNoteId];

        if (branch) {
            branch.update(ec.entity);
            loadResults.addBranch(ec.entityId, ec.sourceId);

            if (ec.entity.isDeleted) {
                if (childNote) {
                    childNote.parents = childNote.parents.filter(parentNoteId => parentNoteId !== ec.entity.parentNoteId);
                    delete childNote.parentToBranch[ec.entity.parentNoteId];
                }

                if (parentNote) {
                    parentNote.children = parentNote.children.filter(childNoteId => childNoteId !== ec.entity.noteId);
                    delete parentNote.childToBranch[ec.entity.noteId];
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
        else if (!ec.entity.isDeleted) {
            if (childNote || parentNote) {
                branch = new Branch(treeCache, ec.entity);
                treeCache.branches[branch.branchId] = branch;

                loadResults.addBranch(ec.entityId, ec.sourceId);

                if (childNote) {
                    childNote.addParent(branch.parentNoteId, branch.branchId);
                }

                if (parentNote) {
                    parentNote.addChild(branch.noteId, branch.branchId);
                }
            }
        }
    }

    for (const ec of entityChanges.filter(ec => ec.entityName === 'note_reordering')) {
        const parentNoteIdsToSort = new Set();

        for (const branchId in ec.positions) {
            const branch = treeCache.branches[branchId];

            if (branch) {
                branch.notePosition = ec.positions[branchId];

                parentNoteIdsToSort.add(branch.parentNoteId);
            }
        }

        for (const parentNoteId of parentNoteIdsToSort) {
            const parentNote = treeCache.notes[parentNoteId];

            if (parentNote) {
                parentNote.sortChildren();
            }
        }

        loadResults.addNoteReordering(ec.entityId, ec.sourceId);
    }

    // missing reloading the relation target note
    for (const ec of entityChanges.filter(ec => ec.entityName === 'attributes')) {
        let attribute = treeCache.attributes[ec.entityId];
        const sourceNote = treeCache.notes[ec.entity.noteId];
        const targetNote = ec.entity.type === 'relation' && treeCache.notes[ec.entity.value];

        if (attribute) {
            attribute.update(ec.entity);
            loadResults.addAttribute(ec.entityId, ec.sourceId);

            if (ec.entity.isDeleted) {
                if (sourceNote) {
                    sourceNote.attributes = sourceNote.attributes.filter(attributeId => attributeId !== attribute.attributeId);
                }

                if (targetNote) {
                    targetNote.targetRelations = targetNote.targetRelations.filter(attributeId => attributeId !== attribute.attributeId);
                }
            }
        }
        else if (!ec.entity.isDeleted) {
            if (sourceNote || targetNote) {
                attribute = new Attribute(treeCache, ec.entity);

                treeCache.attributes[attribute.attributeId] = attribute;

                loadResults.addAttribute(ec.entityId, ec.sourceId);

                if (sourceNote && !sourceNote.attributes.includes(attribute.attributeId)) {
                    sourceNote.attributes.push(attribute.attributeId);
                }

                if (targetNote && !targetNote.targetRelations.includes(attribute.attributeId)) {
                    targetNote.targetRelations.push(attribute.attributeId);
                }
            }
        }
    }

    for (const ec of entityChanges.filter(ec => ec.entityName === 'note_contents')) {
        delete treeCache.noteComplementPromises[ec.entityId];

        loadResults.addNoteContent(ec.entityId, ec.sourceId);
    }

    for (const ec of entityChanges.filter(ec => ec.entityName === 'note_revisions')) {
        loadResults.addNoteRevision(ec.entityId, ec.noteId, ec.sourceId);
    }

    for (const ec of entityChanges.filter(ec => ec.entityName === 'options')) {
        if (ec.entity.name === 'openTabs') {
            continue; // only noise
        }

        options.set(ec.entity.name, ec.entity.value);

        loadResults.addOption(ec.entity.name);
    }

    const missingNoteIds = [];

    for (const {entityName, entity} of entityChanges) {
        if (entityName === 'branches' && !(entity.parentNoteId in treeCache.notes)) {
            missingNoteIds.push(entity.parentNoteId);
        }
        else if (entityName === 'attributes'
            && entity.type === 'relation'
            && entity.name === 'template'
            && !(entity.value in treeCache.notes)) {

            missingNoteIds.push(entity.value);
        }
    }

    if (missingNoteIds.length > 0) {
        await treeCache.reloadNotes(missingNoteIds);
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
    waitForEntityChangeId,
    waitForMaxKnownEntityChangeId,
    getMaxKnownEntityChangeSyncId: () => lastAcceptedEntityChangeSyncId
};
