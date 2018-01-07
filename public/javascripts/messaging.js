"use strict";

const messaging = (function() {
    const changesToPushCountEl = $("#changes-to-push-count");

    function logError(message) {
        console.log(now(), message); // needs to be separate from .trace()
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
                console.log(now(), "Sync data: ", message.data);

                lastSyncId = message.data[message.data.length - 1].id;
            }

            const syncData = message.data.filter(sync => sync.source_id !== glob.sourceId);

            if (syncData.some(sync => sync.entity_name === 'notes_tree')
                || syncData.some(sync => sync.entity_name === 'notes')) {

                console.log(now(), "Reloading tree because of background changes");

                noteTree.reload();
            }

            if (syncData.some(sync => sync.entity_name === 'notes' && sync.entity_id === noteEditor.getCurrentNoteId())) {
                showMessage('Reloading note because background change');

                noteEditor.reload();
            }

            if (syncData.some(sync => sync.entity_name === 'recent_notes')) {
                console.log(now(), "Reloading recent notes because of background changes");

                recentNotes.reload();
            }

            // we don't detect image changes here since images themselves are immutable and references should be
            // updated in note detail as well

            changesToPushCountEl.html(message.changesToPushCount);
        }
        else if (message.type === 'sync-hash-check-failed') {
            showError("Sync check failed!", 60000);
        }
        else if (message.type === 'consistency-checks-failed') {
            showError("Consistency checks failed! See logs for details.", 50 * 60000);
        }
    }

    function connectWebSocket() {
        const protocol = document.location.protocol === 'https:' ? 'wss' : 'ws';

        // use wss for secure messaging
        const ws = new WebSocket(protocol + "://" + location.host);
        ws.onopen = event => console.log(now(), "Connected to server with WebSocket");
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
        if (new Date().getTime() - lastPingTs > 5000) {
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

            showMessage("Re-connected to server");
        }

        ws.send(JSON.stringify({
            type: 'ping',
            lastSyncId: lastSyncId
        }));
    }, 1000);

    return {
        logError
    };
})();