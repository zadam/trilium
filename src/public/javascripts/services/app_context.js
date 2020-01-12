import GlobalButtonsWidget from "../widgets/global_buttons.js";
import SearchBoxWidget from "../widgets/search_box.js";
import SearchResultsWidget from "../widgets/search_results.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import treeService from "./tree.js";
import noteDetailService from "./note_detail.js";
import TabContext from "./tab_context.js";
import server from "./server.js";
import keyboardActionService from "./keyboard_actions.js";
import TabRowWidget from "./tab_row.js";

class AppContext {
    constructor() {
        this.widgets = [];
        /** @type {TabContext[]} */
        this.tabContexts = [];
        this.tabsChangedTaskId = null;
        /** @type {TabRowWidget} */
        this.tabRow = null;
    }

    showWidgets() {
        const $leftPane = $("#left-pane");

        this.tabRow = new TabRowWidget(this);
        const contents = this.tabRow.render();

        $("#global-menu-wrapper").after(contents);

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
        const activeTabEl = this.tabRow.activeTabEl;

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

    /**
     * @return {NoteTreeWidget}
     */
    getMainNoteTree() {
        return this.noteTreeWidget;
    }

    getTab(newTab, state) {
        if (!this.getActiveTabContext() || newTab) {
            // if it's a new tab explicitly by user then it's in background
            const ctx = new TabContext(this.tabRow, state);
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
        const ctx = new TabContext(this.tabRow);
        this.tabContexts.push(ctx);

        await this.tabRow.activateTab(ctx.$tab[0]);
    }

    async filterTabs(noteId) {
        for (const tc of this.tabContexts) {
            if (tc.notePath && !tc.notePath.split("/").includes(noteId)) {
                await this.tabRow.removeTab(tc.$tab[0]);
            }
        }

        if (this.tabContexts.length === 0) {
            this.openEmptyTab()
        }

        await this.saveOpenTabs();
    }

    async saveOpenTabs() {
        const openTabs = [];

        for (const tabEl of this.tabRow.tabEls) {
            const tabId = tabEl.getAttribute('data-tab-id');
            const tabContext = appContext.getTabContexts().find(tc => tc.tabId === tabId);

            if (tabContext) {
                const tabState = tabContext.getTabState();

                if (tabState) {
                    openTabs.push(tabState);
                }
            }
        }

        await server.put('options', {
            openTabs: JSON.stringify(openTabs)
        });
    }

    clearOpenTabsTask() {
        if (this.tabsChangedTaskId) {
            clearTimeout(this.tabsChangedTaskId);
        }
    }

    openTabsChanged() {
        // we don't want to send too many requests with tab changes so we always schedule task to do this in 1 seconds,
        // but if there's any change in between, we cancel the old one and schedule new one
        // so effectively we kind of wait until user stopped e.g. quickly switching tabs
        this.clearOpenTabsTask();

        this.tabsChangedTaskId = setTimeout(() => this.saveOpenTabs(), 1000);
    }

    async activateTab(tabContext) {
        return this.tabRow.activateTab(tabContext.$tab[0]);
    }

    newTabListener() {
        this.openEmptyTab();
    }

    async activeTabChangedListener({tabEl}) {
        const tabId = tabEl.getAttribute('data-tab-id');

        await this.showTab(tabId);
    }

    async tabRemoveListener({tabEl}) {
        const tabId = tabEl.getAttribute('data-tab-id');

        this.tabContexts.filter(nc => nc.tabId === tabId)
            .forEach(tc => tc.remove());

        this.tabContexts = this.tabContexts.filter(nc => nc.tabId !== tabId);

        if (this.tabContexts.length === 0) {
            this.openEmptyTab();
        }

        this.openTabsChanged();
    }

    tabReorderListener() {
        this.openTabsChanged();
    }
}

const appContext = new AppContext();

keyboardActionService.setGlobalActionHandler('OpenNewTab', () => {
    appContext.openEmptyTab();
});

keyboardActionService.setGlobalActionHandler('CloseActiveTab', () => {
    if (this.tabRow.activeTabEl) {
        this.tabRow.removeTab(this.tabRow.activeTabEl);
    }
});

keyboardActionService.setGlobalActionHandler('ActivateNextTab', () => {
    const nextTab = this.tabRow.nextTabEl;

    if (nextTab) {
        this.tabRow.activateTab(nextTab);
    }
});

keyboardActionService.setGlobalActionHandler('ActivatePreviousTab', () => {
    const prevTab = this.tabRow.previousTabEl;

    if (prevTab) {
        this.tabRow.activateTab(prevTab);
    }
});

export default appContext;