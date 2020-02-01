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
    focusOnTitle,
    focusAndSelectTitle,
    getActiveEditor,
    noteChanged
};