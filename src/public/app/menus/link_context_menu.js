import contextMenu from "./context_menu.js";
import appContext from "../components/app_context.js";

function openContextMenu(notePath, hoistedNoteId, e, callback) {
    contextMenu.show({
        x: e.pageX,
        y: e.pageY,
        items: [
            {title: "Open note in a new tab", command: "openNoteInNewTab", uiIcon: "bx bx-empty"},
            {title: "Open note in a new split", command: "openNoteInNewSplit", uiIcon: "bx bx-dock-right"},
            {title: "Open note in a new window", command: "openNoteInNewWindow", uiIcon: "bx bx-window-open"}
        ],
        selectMenuItemHandler: async ({command}) => {
            if (!hoistedNoteId) {
                hoistedNoteId = appContext.tabManager.getActiveContext().hoistedNoteId;
            }

            if (command === 'openNoteInNewTab') {
                await appContext.tabManager.openContextWithNote(notePath, {hoistedNoteId});
            }
            else if (command === 'openNoteInNewSplit') {
                const subContexts = appContext.tabManager.getActiveContext().getSubContexts();
                const {ntxId} = subContexts[subContexts.length - 1];

                await appContext.triggerCommand("openNewNoteSplit", {ntxId, notePath, hoistedNoteId});
            }
            else if (command === 'openNoteInNewWindow') {
                await appContext.triggerCommand('openInWindow', {notePath, hoistedNoteId});
            }
            callback && callback()
        }
    });
}

export default {
    openContextMenu
}
