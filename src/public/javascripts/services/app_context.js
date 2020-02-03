import GlobalButtonsWidget from "../widgets/global_buttons.js";
import SearchBoxWidget from "../widgets/search_box.js";
import SearchResultsWidget from "../widgets/search_results.js";
import NoteTreeWidget from "../widgets/note_tree.js";
import TabContext from "./tab_context.js";
import server from "./server.js";
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
import NotePathsWidget from "../widgets/note_paths.js";
import RunScriptButtonsWidget from "../widgets/run_script_buttons.js";
import ProtectedNoteSwitchWidget from "../widgets/protected_note_switch.js";
import NoteTypeWidget from "../widgets/note_type.js";
import NoteActionsWidget from "../widgets/note_actions.js";
import protectedSessionHolder from "./protected_session_holder.js";
import bundleService from "./bundle.js";
import DialogEventComponent from "./dialog_events.js";
import Entrypoints from "./entrypoints.js";
import CalendarWidget from "../widgets/calendar.js";
import optionsService from "./options.js";
import utils from "./utils.js";
import treeService from "./tree.js";

class AppContext {
    constructor() {
        this.components = [];
        /** @type {TabContext[]} */
        this.tabContexts = [];
        this.tabsChangedTaskId = null;
        /** @type {TabRowWidget} */
        this.tabRow = null;
        this.activeTabId = null;
    }

    start() {
        this.showWidgets();

        this.loadTabs();

        bundleService.executeStartupBundles();
    }

    async loadTabs() {
        const options = await optionsService.waitForOptions();

        const openTabs = options.getJson('openTabs') || [];

        await treeCache.initializedPromise;

        // if there's notePath in the URL, make sure it's open and active
        // (useful, among others, for opening clipped notes from clipper)
        if (window.location.hash) {
            const notePath = window.location.hash.substr(1);
            const noteId = treeService.getNoteIdFromNotePath(notePath);

            if (noteId && await treeCache.noteExists(noteId)) {
                for (const tab of openTabs) {
                    tab.active = false;
                }

                const foundTab = openTabs.find(tab => noteId === treeService.getNoteIdFromNotePath(tab.notePath));

                if (foundTab) {
                    foundTab.active = true;
                }
                else {
                    openTabs.push({
                        notePath: notePath,
                        active: true
                    });
                }
            }
        }

        let filteredTabs = [];

        for (const openTab of openTabs) {
            const noteId = treeService.getNoteIdFromNotePath(openTab.notePath);

            if (await treeCache.noteExists(noteId)) {
                // note doesn't exist so don't try to open tab for it
                filteredTabs.push(openTab);
            }
        }

        if (utils.isMobile()) {
            // mobile frontend doesn't have tabs so show only the active tab
            filteredTabs = filteredTabs.filter(tab => tab.active);
        }

        if (filteredTabs.length === 0) {
            filteredTabs.push({
                notePath: 'root',
                active: true
            });
        }

        if (!filteredTabs.find(tab => tab.active)) {
            filteredTabs[0].active = true;
        }

        for (const tab of filteredTabs) {
            const tabContext = this.openEmptyTab();
            tabContext.setNote(tab.notePath);

            if (tab.active) {
                this.activateTab(tabContext.tabId);
            }
        }

        // previous opening triggered task to save tab changes but these are bogus changes (this is init)
        // so we'll cancel it
        this.clearOpenTabsTask();
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
            new TabCachingWidget(this, () => new CalendarWidget(this)),
            new TabCachingWidget(this, () => new AttributesWidget(this)),
            new TabCachingWidget(this, () => new LinkMapWidget(this)),
            new TabCachingWidget(this, () => new NoteRevisionsWidget(this)),
            new TabCachingWidget(this, () => new SimilarNotesWidget(this)),
            new TabCachingWidget(this, () => new WhatLinksHereWidget(this))
        ];

        for (const widget of rightPaneWidgets) {
            $rightPane.append(widget.render());
        }

        this.components = [
            new Entrypoints(),
            this.tabRow,
            new DialogEventComponent(this),
            ...leftPaneWidgets,
            ...centerPaneWidgets,
            ...rightPaneWidgets
        ];
    }

    trigger(name, data, sync = false) {
        this.eventReceived(name, data);

        for (const component of this.components) {
            component.eventReceived(name, data, sync);
        }
    }

    async eventReceived(name, data, sync) {
        const fun = this[name + 'Listener'];

        if (typeof fun === 'function') {
            await fun.call(this, data, sync);
        }
    }

    tabNoteSwitchedListener({tabId}) {
        if (tabId === this.activeTabId) {
            this._setCurrentNotePathToHash();
        }
    }

    _setCurrentNotePathToHash() {
        const activeTabContext = this.getActiveTabContext();

        if (activeTabContext && activeTabContext.notePath) {
            document.location.hash = (activeTabContext.notePath || "") + "-" + activeTabContext.tabId;
        }
    }

    /** @return {TabContext[]} */
    getTabContexts() {
        return this.tabContexts;
    }

    /** @returns {TabContext} */
    getTabContextById(tabId) {
        return this.tabContexts.find(tc => tc.tabId === tabId);
    }

    /** @returns {TabContext} */
    getActiveTabContext() {
        return this.getTabContextById(this.activeTabId);
    }

    /** @returns {string|null} */
    getActiveTabNotePath() {
        const activeContext = this.getActiveTabContext();
        return activeContext ? activeContext.notePath : null;
    }

    /** @return {NoteShort} */
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
        const tabContext = this.tabContexts.find(tc => tc.tabId === tabId)
                         || this.openEmptyTab();

        this.activateTab(tabContext.tabId);
        await tabContext.setNote(notePath);
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
            this.components.push(ctx);

            return ctx;
        } else {
            return this.getActiveTabContext();
        }
    }

    async openAndActivateEmptyTab() {
        const tabContext = this.openEmptyTab();

        await this.activateTab(tabContext.tabId);
    }

    openEmptyTab() {
        const tabContext = new TabContext(this, this.tabRow);
        this.tabContexts.push(tabContext);
        this.components.push(tabContext);
        return tabContext;
    }

    async activateOrOpenNote(noteId) {
        for (const tabContext of this.getTabContexts()) {
            if (tabContext.note && tabContext.note.noteId === noteId) {
                await tabContext.activate();
                return;
            }
        }

        // if no tab with this note has been found we'll create new tab

        const tabContext = this.openEmptyTab();
        await tabContext.setNote(noteId);
    }

    hoistedNoteChangedListener({hoistedNoteId}) {
        if (hoistedNoteId === 'root') {
            return;
        }

        for (const tc of this.tabContexts) {
            if (tc.notePath && !tc.notePath.split("/").includes(hoistedNoteId)) {
                this.tabRow.removeTab(tc.tabId);
            }
        }

        if (this.tabContexts.length === 0) {
            this.openAndActivateEmptyTab();
        }

        this.saveOpenTabs();
    }

    async saveOpenTabs() {
        const openTabs = [];

        for (const tabId of this.tabRow.getTabIdsInOrder()) {
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

    openTabsChangedListener() {
        // we don't want to send too many requests with tab changes so we always schedule task to do this in 1 seconds,
        // but if there's any change in between, we cancel the old one and schedule new one
        // so effectively we kind of wait until user stopped e.g. quickly switching tabs
        this.clearOpenTabsTask();

        this.tabsChangedTaskId = setTimeout(() => this.saveOpenTabs(), 1000);
    }

    activateTab(tabId) {
        if (tabId === this.activeTabId) {
            return;
        }

        const oldActiveTabId = this.activeTabId;

        this.activeTabId = tabId;

        this.trigger('activeTabChanged', { oldActiveTabId, newActiveTabId: tabId });
    }

    newTabListener() {
        this.openAndActivateEmptyTab();
    }

    async removeTab(tabId) {
        const tabContextToRemove = this.tabContexts.find(tc => tc.tabId === tabId);
        const tabIdsInOrder = this.tabRow.getTabIdsInOrder();

        if (!tabContextToRemove) {
            return;
        }

        if (this.tabContexts.length === 0) {
            this.openAndActivateEmptyTab();
        }
        else {
            const oldIdx = tabIdsInOrder.findIndex(tid => tid === tabId);
            const newActiveTabId = tabIdsInOrder[oldIdx === tabIdsInOrder.length - 1 ? oldIdx - 1 : oldIdx + 1];

            if (newActiveTabId) {
                this.activateTab(newActiveTabId);
            }
            else {
                console.log("Failed to find next tabcontext to activate");
            }
        }

        await tabContextToRemove.remove();

        this.tabContexts = this.tabContexts.filter(tc => tc.tabId === tabId);

        this.openTabsChangedListener();
    }

    tabReorderListener() {
        this.openTabsChangedListener();
    }

    // FIXME non existent event
    noteChangesSavedListener() {
        const activeTabContext = this.getActiveTabContext();

        if (!activeTabContext || !activeTabContext.note) {
            return;
        }

        if (activeTabContext.note.isProtected && protectedSessionHolder.isProtectedSessionAvailable()) {
            protectedSessionHolder.touchProtectedSession();
        }

        // run async
        bundleService.executeRelationBundles(activeTabContext.note, 'runOnNoteChange', activeTabContext);
    }

    activateNextTabListener() {
        const tabIdsInOrder = this.tabRow.getTabIdsInOrder();
        const oldIdx = tabIdsInOrder.findIndex(tid => tid === this.activeTabId);
        const newActiveTabId = tabIdsInOrder[oldIdx === tabIdsInOrder.length - 1 ? 0 : oldIdx + 1];

        this.activateTab(newActiveTabId);
    }

    activatePreviousTabListener() {
        const tabIdsInOrder = this.tabRow.getTabIdsInOrder();
        const oldIdx = tabIdsInOrder.findIndex(tid => tid === this.activeTabId);
        const newActiveTabId = tabIdsInOrder[oldIdx === 0 ? tabIdsInOrder.length - 1 : oldIdx - 1];

        this.activateTab(newActiveTabId);
    }

    closeActiveTabListener() {
        this.removeTab(this.activeTabId);
    }

    openNewTabListener() {
        this.openAndActivateEmptyTab();
    }

    removeAllTabsListener() {
        // TODO
    }

    removeAllTabsExceptForThis() {
        // TODO
    }

    async protectedSessionStartedListener() {
        await treeCache.loadInitialTree();

        this.trigger('treeCacheReloaded');
    }
}

const appContext = new AppContext();

// we should save all outstanding changes before the page/app is closed
$(window).on('beforeunload', () => {
    appContext.trigger('beforeUnload');
});

function isNotePathInAddress() {
    const [notePath, tabId] = getHashValueFromAddress();

    return notePath.startsWith("root")
        // empty string is for empty/uninitialized tab
        || (notePath === '' && !!tabId);
}

function getHashValueFromAddress() {
    const str = document.location.hash ? document.location.hash.substr(1) : ""; // strip initial #

    return str.split("-");
}

$(window).on('hashchange', function() {
    if (isNotePathInAddress()) {
        const [notePath, tabId] = getHashValueFromAddress();

        appContext.switchToTab(tabId, notePath);
    }
});

export default appContext;