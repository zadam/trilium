import GlobalButtonsWidget from "../widgets/global_buttons.js";
import SearchBoxWidget from "../widgets/search_box.js";
import SearchResultsWidget from "../widgets/search_results.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import tabRow from "./tab_row.js";
import treeService from "./tree.js";
import noteDetailService from "./note_detail.js";
import TabContext from "./tab_context.js";

class AppContext {
    constructor() {
        this.widgets = [];
        /** @type {TabContext[]} */
        this.tabContexts = [];
    }

    trigger(name, data) {
        for (const widget of this.widgets) {
            widget.eventReceived(name, data);
        }
    }

    /** @return {TabContext[]} */
    getTabContexts() {
        return this.tabContexts;
    }

    /** @returns {TabContext} */
    getActiveTabContext() {
        const activeTabEl = tabRow.activeTabEl;

        if (!activeTabEl) {
            return null;
        }

        const tabId = activeTabEl.getAttribute('data-tab-id');

        return this.tabContexts.find(tc => tc.tabId === tabId);
    }

    /** @returns {string|null} */
    getActiveTabNotePath() {
        const activeContext = this.getActiveTabContext();
        return activeContext ? activeContext.notePath : null;
    }

    /** @return {NoteFull} */
    getActiveTabNote() {
        const activeContext = this.getActiveTabContext();
        return activeContext ? activeContext.note : null;
    }

    /** @return {string|null} */
    getActiveTabNoteId() {
        const activeNote = this.getActiveTabNote();

        return activeNote ? activeNote.noteId : null;
    }

    /** @return {string|null} */
    getActiveTabNoteType() {
        const activeNote = this.getActiveTabNote();

        return activeNote ? activeNote.type : null;
    }

    async switchToTab(tabId, notePath) {
        const tabContext = this.tabContexts.find(tc => tc.tabId === tabId);

        if (!tabContext) {
            await noteDetailService.loadNoteDetail(notePath, {
                newTab: true,
                activate: true
            });
        } else {
            await tabContext.activate();

            if (notePath && tabContext.notePath !== notePath) {
                await treeService.activateNote(notePath);
            }
        }
    }

    async showTab(tabId) {
        for (const ctx of this.tabContexts) {
            if (ctx.tabId === tabId) {
                await ctx.show();
            } else {
                ctx.hide();
            }
        }

        const oldActiveNode = this.getMainNoteTree().getActiveNode();

        if (oldActiveNode) {
            oldActiveNode.setActive(false);
        }

        const newActiveTabContext = this.getActiveTabContext();

        if (newActiveTabContext && newActiveTabContext.notePath) {
            const newActiveNode = await this.getMainNoteTree().getNodeFromPath(newActiveTabContext.notePath);

            if (newActiveNode) {
                if (!newActiveNode.isVisible()) {
                    await this.getMainNoteTree().expandToNote(newActiveTabContext.notePath);
                }

                newActiveNode.setActive(true, {noEvents: true});
            }
        }
    }

    showWidgets() {
        const $leftPane = $("#left-pane");

        this.noteTreeWidget = new NoteTreeWidget(this);

        this.widgets = [
            new GlobalButtonsWidget(this),
            new SearchBoxWidget(this),
            new SearchResultsWidget(this),
            this.noteTreeWidget
        ];

        for (const widget of this.widgets) {
            const $widget = widget.render();

            $leftPane.append($widget);
        }
    }

    /**
     * @return {NoteTreeWidget}
     */
    getMainNoteTree() {
        return this.noteTreeWidget;
    }

    getTab(newTab, state) {
        if (!this.getActiveTabContext() || newTab) {
            // if it's a new tab explicitly by user then it's in background
            const ctx = new TabContext(tabRow, state);
            this.tabContexts.push(ctx);

            return ctx;
        } else {
            return this.getActiveTabContext();
        }
    }

    async reloadAllTabs() {
        for (const tabContext of this.tabContexts) {
            await this.reloadTab(tabContext);
        }
    }

    async refreshTabs(sourceTabId, noteId) {
        for (const tc of this.tabContexts) {
            if (tc.noteId === noteId && tc.tabId !== sourceTabId) {
                await this.reloadTab(tc);
            }
        }
    }

    async reloadTab(tc) {
        if (tc.note) {
            noteDetailService.reloadNote(tc);
        }
    }

    async openEmptyTab() {
        const ctx = new TabContext(tabRow);
        this.tabContexts.push(ctx);

        await tabRow.activateTab(ctx.$tab[0]);
    }
}

const appContext = new AppContext();

tabRow.addListener('newTab', () => appContext.openEmptyTab());

tabRow.addListener('activeTabChange', async ({ detail }) => {
    const tabId = detail.tabEl.getAttribute('data-tab-id');

    await appContext.showTab(tabId);
});

tabRow.addListener('tabRemove', async ({ detail }) => {
    const tabId = detail.tabEl.getAttribute('data-tab-id');

    appContext.tabContexts.filter(nc => nc.tabId === tabId)
        .forEach(tc => tc.remove());

    appContext.tabContexts = appContext.tabContexts.filter(nc => nc.tabId !== tabId);

    if (appContext.tabContexts.length === 0) {
        appContext.openEmptyTab();
    }
});

export default appContext;