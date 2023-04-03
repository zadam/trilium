import contextMenu from "./context_menu.js";
import appContext from "../components/app_context.js";

function openContextMenu(notePath, e, viewScope = {}, hoistedNoteId = null) {
    contextMenu.show({
        x: e.pageX,
        y: e.pageY,
        items: [
            {title: "Open note in a new tab", command: "openNoteInNewTab", uiIcon: "bx bx-empty"},
            {title: "Open note in a new split", command: "openNoteInNewSplit", uiIcon: "bx bx-dock-right"},
            {title: "Open note in a new window", command: "openNoteInNewWindow", uiIcon: "bx bx-window-open"}
        ],
        selectMenuItemHandler: ({command}) => {
            if (!hoistedNoteId) {
                hoistedNoteId = appContext.tabManager.getActiveContext().hoistedNoteId;
            }

            if (command === 'openNoteInNewTab') {
                appContext.tabManager.openContextWithNote(notePath, { hoistedNoteId, viewScope });
            }
            else if (command === 'openNoteInNewSplit') {
                const subContexts = appContext.tabManager.getActiveContext().getSubContexts();
                const {ntxId} = subContexts[subContexts.length - 1];

                appContext.triggerCommand("openNewNoteSplit", {ntxId, notePath, hoistedNoteId, viewScope});
            }
            else if (command === 'openNoteInNewWindow') {
                appContext.triggerCommand('openInWindow', {notePath, hoistedNoteId, viewScope});
            }
        }
    });
}

export default {
    openContextMenu
}
