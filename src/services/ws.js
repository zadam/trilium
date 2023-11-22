const WebSocket = require('ws');
const utils = require('./utils.js');
const log = require('./log.js');
const sql = require('./sql.js');
const cls = require('./cls.js');
const config = require('./config.js');
const syncMutexService = require('./sync_mutex.js');
const protectedSessionService = require('./protected_session.js');
const becca = require('../becca/becca.js');
const AbstractBeccaEntity = require('../becca/entities/abstract_becca_entity.js');

const env = require('./env.js');
if (env.isDev()) {
    const chokidar = require('chokidar');
    const debounce = require('debounce');
    const debouncedReloadFrontend = debounce(() => reloadFrontend("source code change"), 200);
    chokidar
        .watch('src/public')
        .on('add', debouncedReloadFrontend)
        .on('change', debouncedReloadFrontend)
        .on('unlink', debouncedReloadFrontend);
}

let webSocketServer;
let lastSyncedPush = null;

function init(httpServer, sessionParser) {
    webSocketServer = new WebSocket.Server({
        verifyClient: (info, done) => {
            sessionParser(info.req, {}, () => {
                const allowed = utils.isElectron()
                    || info.req.session.loggedIn
                    || (config.General && config.General.noAuthentication);

                if (!allowed) {
                    log.error("WebSocket connection not allowed because session is neither electron nor logged in.");
                }

                done(allowed)
            });
        },
        server: httpServer
    });

    webSocketServer.on('connection', (ws, req) => {
        ws.id = utils.randomString(10);

        console.log(`websocket client connected`);

        ws.on('message', async messageJson => {
            const message = JSON.parse(messageJson);

            if (message.type === 'log-error') {
                log.info(`JS Error: ${message.error}\r
Stack: ${message.stack}`);
            }
            else if (message.type === 'log-info') {
                log.info(`JS Info: ${message.info}`);
            }
            else if (message.type === 'ping') {
                await syncMutexService.doExclusively(() => sendPing(ws));
            }
            else {
                log.error('Unrecognized message: ');
                log.error(message);
            }
        });
    });

    webSocketServer.on('error', error => {
        // https://github.com/zadam/trilium/issues/3374#issuecomment-1341053765
        console.log(error);
    });
}

function sendMessage(client, message) {
    const jsonStr = JSON.stringify(message);

    if (client.readyState === WebSocket.OPEN) {
        client.send(jsonStr);
    }
}

function sendMessageToAllClients(message) {
    const jsonStr = JSON.stringify(message);

    if (webSocketServer) {
        if (message.type !== 'sync-failed' && message.type !== 'api-log-messages') {
            log.info(`Sending message to all clients: ${jsonStr}`);
        }

        webSocketServer.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(jsonStr);
            }
        });
    }
}

function fillInAdditionalProperties(entityChange) {
    if (entityChange.isErased) {
        return;
    }

    // fill in some extra data needed by the frontend
    // first try to use becca, which works for non-deleted entities
    // only when that fails, try to load from the database
    if (entityChange.entityName === 'attributes') {
        entityChange.entity = becca.getAttribute(entityChange.entityId);

        if (!entityChange.entity) {
            entityChange.entity = sql.getRow(`SELECT * FROM attributes WHERE attributeId = ?`, [entityChange.entityId]);
        }
    } else if (entityChange.entityName === 'branches') {
        entityChange.entity = becca.getBranch(entityChange.entityId);

        if (!entityChange.entity) {
            entityChange.entity = sql.getRow(`SELECT * FROM branches WHERE branchId = ?`, [entityChange.entityId]);
        }
    } else if (entityChange.entityName === 'notes') {
        entityChange.entity = becca.getNote(entityChange.entityId);

        if (!entityChange.entity) {
            entityChange.entity = sql.getRow(`SELECT * FROM notes WHERE noteId = ?`, [entityChange.entityId]);

            if (entityChange.entity.isProtected) {
                entityChange.entity.title = protectedSessionService.decryptString(entityChange.entity.title);
            }
        }
    } else if (entityChange.entityName === 'revisions') {
        entityChange.noteId = sql.getValue(`SELECT noteId
                                          FROM revisions
                                          WHERE revisionId = ?`, [entityChange.entityId]);
    } else if (entityChange.entityName === 'note_reordering') {
        entityChange.positions = {};

        const parentNote = becca.getNote(entityChange.entityId);

        if (parentNote) {
            for (const childBranch of parentNote.getChildBranches()) {
                entityChange.positions[childBranch.branchId] = childBranch.notePosition;
            }
        }
    } else if (entityChange.entityName === 'options') {
        entityChange.entity = becca.getOption(entityChange.entityId);

        if (!entityChange.entity) {
            entityChange.entity = sql.getRow(`SELECT * FROM options WHERE name = ?`, [entityChange.entityId]);
        }
    } else if (entityChange.entityName === 'attachments') {
        entityChange.entity = sql.getRow(`SELECT attachments.*, LENGTH(blobs.content) AS contentLength
                                                FROM attachments
                                                JOIN blobs USING (blobId)
                                                WHERE attachmentId = ?`, [entityChange.entityId]);
    }

    if (entityChange.entity instanceof AbstractBeccaEntity) {
        entityChange.entity = entityChange.entity.getPojo();
    }
}

// entities with higher number can reference the entities with lower number
const ORDERING = {
    "etapi_tokens": 0,
    "attributes": 2,
    "branches": 2,
    "blobs": 0,
    "note_reordering": 2,
    "revisions": 2,
    "attachments": 3,
    "notes": 1,
    "options": 0
};

function sendPing(client, entityChangeIds = []) {
    if (entityChangeIds.length === 0) {
        sendMessage(client, { type: 'ping' });

        return;
    }

    const entityChanges = sql.getManyRows(`SELECT * FROM entity_changes WHERE id IN (???)`, entityChangeIds);

    // sort entity changes since froca expects "referential order", i.e. referenced entities should already exist
    // in froca.
    // Froca needs this since it is an incomplete copy, it can't create "skeletons" like becca.
    entityChanges.sort((a, b) => ORDERING[a.entityName] - ORDERING[b.entityName]);

    for (const entityChange of entityChanges) {
        try {
            fillInAdditionalProperties(entityChange);
        }
        catch (e) {
            log.error(`Could not fill additional properties for entity change ${JSON.stringify(entityChange)} because of error: ${e.message}: ${e.stack}`);
        }
    }

    sendMessage(client, {
        type: 'frontend-update',
        data: {
            lastSyncedPush,
            entityChanges
        }
    });
}

function sendTransactionEntityChangesToAllClients() {
    if (webSocketServer) {
        const entityChangeIds = cls.getAndClearEntityChangeIds();

        webSocketServer.clients.forEach(client => sendPing(client, entityChangeIds));
    }
}

function syncPullInProgress() {
    sendMessageToAllClients({ type: 'sync-pull-in-progress', lastSyncedPush });
}

function syncPushInProgress() {
    sendMessageToAllClients({ type: 'sync-push-in-progress', lastSyncedPush });
}

function syncFinished() {
    sendMessageToAllClients({ type: 'sync-finished', lastSyncedPush });
}

function syncFailed() {
    sendMessageToAllClients({ type: 'sync-failed', lastSyncedPush });
}

function reloadFrontend(reason) {
    sendMessageToAllClients({ type: 'reload-frontend', reason });
}

function setLastSyncedPush(entityChangeId) {
    lastSyncedPush = entityChangeId;
}

module.exports = {
    init,
    sendMessageToAllClients,
    syncPushInProgress,
    syncPullInProgress,
    syncFinished,
    syncFailed,
    sendTransactionEntityChangesToAllClients,
    setLastSyncedPush,
    reloadFrontend
};
