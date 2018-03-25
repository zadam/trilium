"use strict";

import treeService from './tree_service.js';
import noteDetailService from './note_detail.js';
import utils from './utils.js';

const $changesToPushCount = $("#changes-to-push-count");

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

function messageHandler(event) {
    const message = JSON.parse(event.data);

    if (message.type === 'sync') {
        lastPingTs = new Date().getTime();

        if (message.data.length > 0) {
            console.log(utils.now(), "Sync data: ", message.data);

            lastSyncId = message.data[message.data.length - 1].id;
        }

        const syncData = message.data.filter(sync => sync.sourceId !== glob.sourceId);

        if (syncData.some(sync => sync.entityName === 'branches')
            || syncData.some(sync => sync.entityName === 'notes')) {

            console.log(utils.now(), "Reloading tree because of background changes");

            treeService.reload();
        }

        if (syncData.some(sync => sync.entityName === 'notes' && sync.entityId === noteDetailService.getCurrentNoteId())) {
            utils.showMessage('Reloading note because of background changes');

            noteDetailService.reload();
        }

        if (syncData.some(sync => sync.entityName === 'recent_notes')) {
            console.log(utils.now(), "Reloading recent notes because of background changes");

            recentNotes.reload();
        }

        // we don't detect image changes here since images themselves are immutable and references should be
        // updated in note detail as well

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
    ws.onmessage = messageHandler;
    ws.onclose = function(){
        // Try to reconnect in 5 seconds
        setTimeout(() => connectWebSocket(), 5000);
    };

    return ws;
}

const ws = connectWebSocket();

let lastSyncId = glob.maxSyncIdAtLoad;
let lastPingTs = new Date().getTime();
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

export default {
    logError
};