import server from './server.js';
import ws from "./ws.js";
import treeCache from "./tree_cache.js";
import NoteFull from "../entities/note_full.js";
import appContext from "./app_context.js";

function getActiveEditor() {
    const activeTabContext = appContext.getActiveTabContext();

    if (activeTabContext && activeTabContext.note && activeTabContext.note.type === 'text') {
        return activeTabContext.getComponent().getEditor();
    }
    else {
        return null;
    }
}

async function loadNote(noteId) {
    const row = await server.get('notes/' + noteId);

    const noteShort = await treeCache.getNote(noteId);

    return new NoteFull(treeCache, row, noteShort);
}

function focusOnTitle() {
    appContext.trigger('focusOnTitle');
}

function focusAndSelectTitle() {
    appContext.trigger('focusAndSelectTitle');
}

ws.subscribeToOutsideSyncMessages(syncData => {
    const noteIdsToRefresh = new Set();

    syncData
        .filter(sync => sync.entityName === 'notes')
        .forEach(sync => noteIdsToRefresh.add(sync.entityId));

    // we need to reload because of promoted attributes
    syncData
        .filter(sync => sync.entityName === 'attributes')
        .forEach(sync => noteIdsToRefresh.add(sync.noteId));

    // FIXME
    for (const noteId of noteIdsToRefresh) {
        appContext.refreshTabs(null, noteId);
    }
});

ws.subscribeToAllSyncMessages(syncData => {
    appContext.trigger('syncData', {data: syncData});
});

function noteChanged() {
    const activeTabContext = appContext.getActiveTabContext();

    if (activeTabContext) {
        activeTabContext.noteChanged();
    }
}

// this makes sure that when user e.g. reloads the page or navigates away from the page, the note's content is saved
// this sends the request asynchronously and doesn't wait for result
// FIXME
$(window).on('beforeunload', () => {
    //saveNotesIfChanged();
 });

export default {
    loadNote,
    focusOnTitle,
    focusAndSelectTitle,
    getActiveEditor,
    noteChanged
};