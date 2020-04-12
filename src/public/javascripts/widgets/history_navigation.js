import BasicWidget from "./basic_widget.js";
import utils from "../services/utils.js";
import keyboardActionService from "../services/keyboard_actions.js";
import contextMenu from "../services/context_menu.js";
import treeService from "../services/tree.js";
import appContext from "../services/app_context.js";

const TPL = `
<div class="history-navigation">
    <style>
    .history-navigation {
        margin: 0 15px 0 5px;
    }
    </style>

    <a title="Go to previous note." data-trigger-command="backInNoteHistory" class="icon-action bx bx-left-arrow-circle"></a>

    <a title="Go to next note." data-trigger-command="forwardInNoteHistory" class="icon-action bx bx-right-arrow-circle"></a>
</div>
`;

export default class HistoryNavigationWidget extends BasicWidget {
    doRender() {
        if (utils.isElectron()) {
            this.$widget = $(TPL);

            const contextMenuHandler = e => {
                e.preventDefault();

                if (this.webContents.history.length < 2) {
                    return;
                }

                this.showContextMenu(e);
            };

            this.$backInHistory = this.$widget.find("[data-trigger-command='backInNoteHistory']");
            this.$backInHistory.on('contextmenu', contextMenuHandler);

            this.$forwardInHistory = this.$widget.find("[data-trigger-command='forwardInNoteHistory']");
            this.$forwardInHistory.on('contextmenu', contextMenuHandler);

            const electron = utils.dynamicRequire('electron');
            this.webContents = electron.remote.getCurrentWindow().webContents;

            // without this the history is preserved across frontend reloads
            this.webContents.clearHistory();

            this.refresh();
        }
        else {
            this.$widget = $("<div>");
        }

        return this.$widget;
    }

    async showContextMenu(e) {
        let items = [];

        const activeIndex = this.webContents.getActiveIndex();

        for (const idx in this.webContents.history) {
            const url = this.webContents.history[idx];
            const [_, notePathWithTab] = url.split('#');
            const [notePath, tabId] = notePathWithTab.split('-');

            const title = await treeService.getNotePathTitle(notePath);

            items.push({
                title,
                idx,
                uiIcon: idx == activeIndex ? "radio-circle-marked" : // compare with type coercion!
                    (idx < activeIndex ? "left-arrow-alt" : "right-arrow-alt")
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

        this.$backInHistory.toggleClass('disabled', !this.webContents.canGoBack());
        this.$forwardInHistory.toggleClass('disabled', !this.webContents.canGoForward());
    }

    activeNoteChangedEvent() {
        this.refresh();
    }
}