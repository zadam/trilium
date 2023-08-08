import utils from "../../services/utils.js";
import contextMenu from "../../menus/context_menu.js";
import treeService from "../../services/tree.js";
import ButtonFromNoteWidget from "./button_from_note.js";

export default class HistoryNavigationButton extends ButtonFromNoteWidget {
    constructor(launcherNote, command) {
        super();

        this.title(() => launcherNote.title)
            .icon(() => launcherNote.getIcon())
            .command(() => command)
            .titlePlacement("right")
            .buttonNoteIdProvider(() => launcherNote.noteId)
            .onContextMenu(e => this.showContextMenu(e))
            .class("launcher-button");
    }

    isEnabled() {
        return super.isEnabled() && utils.isElectron();
    }

    doRender() {
        super.doRender();

        if (!utils.isElectron()) {
            return;
        }

        this.webContents = utils.dynamicRequire('@electron/remote').getCurrentWebContents();

        // without this, the history is preserved across frontend reloads
        this.webContents.clearHistory();

        this.refresh();
    }

    async showContextMenu(e) {
        e.preventDefault();

        // API is broken and will be replaced: https://github.com/electron/electron/issues/33899
        // until then no context menu
        if (true) { // avoid warning in dev console
            return;
        }

        if (this.webContents.history.length < 2) {
            return;
        }

        let items = [];

        const activeIndex = this.webContents.getActiveIndex();

        for (const idx in this.webContents.history) {
            const url = this.webContents.history[idx];
            const [_, notePathWithTab] = url.split('#');
            // broken: use linkService.parseNavigationStateFromUrl();
            const [notePath, ntxId] = notePathWithTab.split('-');

            const title = await treeService.getNotePathTitle(notePath);

            items.push({
                title,
                idx,
                uiIcon: idx == activeIndex ? "bx bx-radio-circle-marked" : // compare with type coercion!
                    (idx < activeIndex ? "bx bx-left-arrow-alt" : "bx bx-right-arrow-alt")
            });
        }

        items.reverse();

        if (items.length > 20) {
            items = items.slice(0, 50);
        }

        contextMenu.show({
            x: e.pageX,
            y: e.pageY,
            items,
            selectMenuItemHandler: ({idx}) => this.webContents.goToIndex(idx)
        });
    }

    refresh() {
        if (!utils.isElectron()) {
            return;
        }

        // disabling this because in electron 9 there's a weird performance problem which makes these webContents calls
        // block UI thread for > 1 second on specific notes (book notes displaying underlying render notes with scripts)

        // this.$backInHistory.toggleClass('disabled', !this.webContents.canGoBack());
        // this.$forwardInHistory.toggleClass('disabled', !this.webContents.canGoForward());
    }

    activeNoteChangedEvent() {
        this.refresh();
    }
}
