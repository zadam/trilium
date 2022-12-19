import OnClickButtonWidget from "./onclick_button.js";
import linkContextMenuService from "../../menus/link_context_menu.js";
import utils from "../../services/utils.js";
import appContext from "../../components/app_context.js";

export default class OpenNoteButtonWidget extends OnClickButtonWidget {
    constructor(noteToOpen) {
        super();

        this.noteToOpen = noteToOpen;

        this.title(() => this.noteToOpen.title)
            .icon(() => this.noteToOpen.getIcon())
            .onClick((widget, evt) => this.launch(evt))
            .onAuxClick((widget, evt) => this.launch(evt))
            .onContextMenu(evt => linkContextMenuService.openContextMenu(this.noteToOpen.noteId, null, evt));
    }

    async launch(evt) {
        const ctrlKey = utils.isCtrlKey(evt);

        if ((evt.which === 1 && ctrlKey) || evt.which === 2) {
            await appContext.tabManager.openInNewTab(this.noteToOpen.noteId);
        } else {
            await appContext.tabManager.openInSameTab(this.noteToOpen.noteId);
        }
    }

    initialRenderCompleteEvent() {
        // we trigger refresh above
    }
}
