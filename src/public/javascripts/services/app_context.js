import NoteTreeWidget from "../widgets/note_tree.js";
import TabContext from "./tab_context.js";
import server from "./server.js";
import treeCache from "./tree_cache.js";
import bundleService from "./bundle.js";
import DialogEventComponent from "./dialog_events.js";
import Entrypoints from "./entrypoints.js";
import options from "./options.js";
import utils from "./utils.js";
import treeService from "./tree.js";
import ZoomService from "./zoom.js";
import Layout from "../widgets/layout.js";

class AppContext {
    constructor(layout) {
        this.layout = layout;
        this.components = [];
        /** @type {TabContext[]} */
        this.tabContexts = [];
        this.tabsChangedTaskId = null;
        this.activeTabId = null;
    }

    async start() {
        options.load(await server.get('options'));

        this.showWidgets();

        this.loadTabs();

        bundleService.executeStartupBundles();
    }

    async loadTabs() {
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
        const rootContainer = this.layout.getRootWidget(this);

        $("body").append(rootContainer.render());

        this.components = [
            rootContainer,
            new Entrypoints(),
            new DialogEventComponent(this)
        ];

        if (utils.isElectron()) {
            this.components.push(new ZoomService(this));

            import("./spell_check.js").then(spellCheckService => spellCheckService.initSpellCheck());
        }

        this.trigger('initialRenderComplete');
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
            const ctx = new TabContext(this, state);
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
        const tabContext = new TabContext(this);
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
                this.removeTab(tc.tabId);
            }
        }

        if (this.tabContexts.length === 0) {
            this.openAndActivateEmptyTab();
        }

        this.saveOpenTabs();
    }

    async saveOpenTabs() {
        const openTabs = [];

        for (const tabContext of this.tabContexts) {
            const tabState = tabContext.getTabState();

            if (tabState) {
                openTabs.push(tabState);
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

        if (!tabContextToRemove) {
            return;
        }

        await this.trigger('beforeTabRemove', {tabId}, true);

        if (this.tabContexts.length === 1) {
            this.openAndActivateEmptyTab();
        }
        else {
            this.activateNextTabListener();
        }

        this.tabContexts = this.tabContexts.filter(tc => tc.tabId === tabId);

        this.trigger('tabRemoved', {tabId});

        this.openTabsChangedListener();
    }

    tabReorderListener({tabIdsInOrder}) {
        const order = {};

        for (const i in tabIdsInOrder) {
            order[tabIdsInOrder[i]] = i;
        }

        this.tabContexts.sort((a, b) => order[a.tabId] < order[b.tabId] ? -1 : 1);

        this.openTabsChangedListener();
    }

    activateNextTabListener() {
        const oldIdx = this.tabContexts.findIndex(tc => tc.tabId === this.activeTabId);
        const newActiveTabId = this.tabContexts[oldIdx === this.tabContexts.length - 1 ? 0 : oldIdx + 1].tabId;

        this.activateTab(newActiveTabId);
    }

    activatePreviousTabListener() {
        const oldIdx = this.tabContexts.findIndex(tc => tc.tabId === this.activeTabId);
        const newActiveTabId = this.tabContexts[oldIdx === 0 ? this.tabContexts.length - 1 : oldIdx - 1].tabId;

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

const layout = new Layout();

const appContext = new AppContext(layout);

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