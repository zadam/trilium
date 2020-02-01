import server from './server.js';
import NoteComplement from "../entities/note_complement.js";
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

async function loadNoteComplement(noteId) {
    if (!noteId) {
        return null;
    }

    const row = await server.get('notes/' + noteId);

    return new NoteComplement(row);
}

function focusOnTitle() {
    appContext.trigger('focusOnTitle');
}

function focusAndSelectTitle() {
    appContext.trigger('focusAndSelectTitle');
}

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
    loadNoteComplement,
    focusOnTitle,
    focusAndSelectTitle,
    getActiveEditor,
    noteChanged
};