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

export default {
    getActiveEditor
};