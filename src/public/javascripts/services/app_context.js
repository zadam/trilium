import GlobalButtonsWidget from "../widgets/global_buttons.js";
import SearchBoxWidget from "../widgets/search_box.js";
import SearchResultsWidget from "../widgets/search_results.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import treeService from "./tree.js";
import noteDetailService from "./note_detail.js";
import TabContext from "./tab_context.js";
import server from "./server.js";
import keyboardActionService from "./keyboard_actions.js";
import TabRowWidget from "../widgets/tab_row.js";
import NoteTitleWidget from "../widgets/note_title.js";
import PromotedAttributesWidget from "../widgets/promoted_attributes.js";
import NoteDetailWidget from "../widgets/note_detail.js";
import TabCachingWidget from "../widgets/tab_caching_widget.js";
import NoteInfoWidget from "../widgets/note_info.js";
import NoteRevisionsWidget from "../widgets/note_revisions.js";
import LinkMapWidget from "../widgets/link_map.js";
import SimilarNotesWidget from "../widgets/similar_notes.js";
import WhatLinksHereWidget from "../widgets/what_links_here.js";
import AttributesWidget from "../widgets/attributes.js";
import TitleBarButtonsWidget from "../widgets/title_bar_buttons.js";
import GlobalMenuWidget from "../widgets/global_menu.js";
import RowFlexContainer from "../widgets/row_flex_container.js";
import StandardTopWidget from "../widgets/standard_top_widget.js";
import treeCache from "./tree_cache.js";
import treeUtils from "./tree_utils.js";
import NotePathsWidget from "../widgets/note_paths.js";
import RunScriptButtonsWidget from "../widgets/run_script_buttons.js";
import ProtectedNoteSwitchWidget from "../widgets/protected_note_switch.js";
import NoteTypeWidget from "../widgets/note_type.js";
import NoteActionsWidget from "../widgets/note_actions.js";
import protectedSessionHolder from "./protected_session_holder.js";

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

        this.tabRow = new TabRowWidget(this);

        const topPaneWidgets = [
            new RowFlexContainer(this, [
                new GlobalMenuWidget(this),
                this.tabRow,
                new TitleBarButtonsWidget(this)
            ]),
            new StandardTopWidget(this)
        ];

        const $topPane = $("#top-pane");

        for (const widget of topPaneWidgets) {
            $topPane.append(widget.render());
        }

        const $leftPane = $("#left-pane");

        this.noteTreeWidget = new NoteTreeWidget(this);

        const leftPaneWidgets = [
            new GlobalButtonsWidget(this),
            new SearchBoxWidget(this),
            new SearchResultsWidget(this),
            this.noteTreeWidget
        ];

        for (const widget of leftPaneWidgets) {
            $leftPane.append(widget.render());
        }

        const $centerPane = $("#center-pane");

        const centerPaneWidgets = [
            new RowFlexContainer(this, [
                new TabCachingWidget(this, () => new NotePathsWidget(this)),
                new NoteTitleWidget(this),
                new RunScriptButtonsWidget(this),
                new ProtectedNoteSwitchWidget(this),
                new NoteTypeWidget(this),
                new NoteActionsWidget(this)
            ]),
            new TabCachingWidget(this, () => new PromotedAttributesWidget(this)),
            new TabCachingWidget(this, () => new NoteDetailWidget(this))
        ];

        for (const widget of centerPaneWidgets) {
            $centerPane.append(widget.render());
        }

        const $rightPane = $("#right-pane");

        const rightPaneWidgets = [
            new NoteInfoWidget(this),
            new TabCachingWidget(this, () => new AttributesWidget(this)),
            new TabCachingWidget(this, () => new LinkMapWidget(this)),
            new TabCachingWidget(this, () => new NoteRevisionsWidget(this)),
            new TabCachingWidget(this, () => new SimilarNotesWidget(this)),
            new TabCachingWidget(this, () => new WhatLinksHereWidget(this)),
        ];

        for (const widget of rightPaneWidgets) {
            $rightPane.append(widget.render());
        }

        this.widgets = [
            this.tabRow,
            ...leftPaneWidgets,
            ...centerPaneWidgets,
            ...rightPaneWidgets
        ];
    }

    trigger(name, data, sync = false) {
        this.eventReceived(name, data);

        for (const tabContext of this.tabContexts) {
            tabContext.eventReceived(name, data, sync);
        }

        for (const widget of this.widgets) {
            widget.eventReceived(name, data, sync);
        }
    }

    async eventReceived(name, data, sync) {
        const fun = this[name + 'Listener'];

        if (typeof fun === 'function') {
            await fun.call(this, data, sync);
        }
    }

    activateNote(notePath) {
        const activeTabContext = this.getActiveTabContext();

        console.log("Setting activeTabContext to " + notePath);

        activeTabContext.setNote(notePath);

        this._setTitleBar();
        this._setCurrentNotePathToHash();
    }

    _setCurrentNotePathToHash() {
        const activeTabContext = this.getActiveTabContext();

        if (activeTabContext && activeTabContext.notePath) {
            document.location.hash = (activeTabContext.notePath || "") + "-" + activeTabContext.tabId;
        }
    }

    noteTitleChangedListener() {
        this._setTitleBar();
    }

    async _setTitleBar() {
        document.title = "Trilium Notes";

        const activeTabContext = this.getActiveTabContext();

        if (activeTabContext && activeTabContext.notePath) {
            const note = await treeCache.getNote(treeUtils.getNoteIdFromNotePath(activeTabContext.notePath));

            // it helps navigating in history if note title is included in the title
            document.title += " - " + note.title;
        }
    }

    /** @return {TabContext[]} */
    getTabContexts() {
        return this.tabContexts;
    }

    /** @returns {TabContext} */
    getActiveTabContext() {
        const tabId = this.tabRow.activeTabId;

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

    /**
     * @return {NoteTreeWidget}
     */
    getMainNoteTree() {
        return this.noteTreeWidget;
    }

    getTab(newTab, state) {
        if (!this.getActiveTabContext() || newTab) {
            // if it's a new tab explicitly by user then it's in background
            const ctx = new TabContext(this, this.tabRow, state);
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
        const ctx = new TabContext(this, this.tabRow);
        this.tabContexts.push(ctx);

        await this.tabRow.activateTab(ctx.$tab[0]);
    }

    async filterTabs(noteId) {
        for (const tc of this.tabContexts) {
            if (tc.notePath && !tc.notePath.split("/").includes(noteId)) {
                this.tabRow.removeTab(tc.tabId);
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

    async tabRemoveListener({tabId}) {
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

    noteChangesSavedListener() {
        const activeTabContext = this.getActiveTabContext();

        if (!activeTabContext || !activeTabContext.note) {
            return;
        }

        if (activeTabContext.note.isProtected && protectedSessionHolder.isProtectedSessionAvailable()) {
            protectedSessionHolder.touchProtectedSession();
        }
    }
}

const appContext = new AppContext();

keyboardActionService.setGlobalActionHandler('OpenNewTab', () => {
    appContext.openEmptyTab();
});

keyboardActionService.setGlobalActionHandler('CloseActiveTab', () => {
    if (this.tabRow.activeTabEl) {
        this.tabRow.removeTab(this.tabRow.activeTabId);
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