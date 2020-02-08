import Component from "../widgets/component.js";
import SpacedUpdate from "./spaced_update.js";
import server from "./server.js";
import options from "./options.js";
import treeCache from "./tree_cache.js";
import treeService from "./tree.js";
import utils from "./utils.js";
import TabContext from "./tab_context.js";

export default class TabManager extends Component {
    constructor(appContext) {
        super(appContext);

        /** @type {TabContext[]} */
        this.tabContexts = [];
        this.activeTabId = null;

        this.tabsUpdate = new SpacedUpdate(async () => {
            const openTabs = this.tabContexts
                .map(tc => tc.getTabState())
                .filter(t => !!t);

            await server.put('options', {
                openTabs: JSON.stringify(openTabs)
            });
        });
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

        await this.tabsUpdate.allowUpdateWithoutChange(async () => {
            for (const tab of filteredTabs) {
                const tabContext = this.openEmptyTab();
                await tabContext.setNote(tab.notePath);

                if (tab.active) {
                    this.activateTab(tabContext.tabId);
                }
            }
        });
    }

    tabNoteSwitchedListener({tabId}) {
        if (tabId === this.activeTabId) {
            this.setCurrentNotePathToHash();
        }

        this.tabsUpdate.scheduleUpdate();
    }

    setCurrentNotePathToHash() {
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

    async openAndActivateEmptyTab() {
        const tabContext = this.openEmptyTab();

        await this.activateTab(tabContext.tabId);
    }

    openEmptyTab() {
        const tabContext = new TabContext(this.appContext);
        this.tabContexts.push(tabContext);
        this.children.push(tabContext);
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

    activateTab(tabId) {
        if (tabId === this.activeTabId) {
            return;
        }

        const oldActiveTabId = this.activeTabId;

        this.activeTabId = tabId;

        this.trigger('activeTabChanged', { oldActiveTabId, newActiveTabId: tabId });

        this.tabsUpdate.scheduleUpdate();
        
        this.setCurrentNotePathToHash();
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

        this.children = this.tabContexts = this.tabContexts.filter(tc => tc.tabId === tabId);

        this.trigger('tabRemoved', {tabId});

        this.tabsUpdate.scheduleUpdate();
    }

    tabReorderListener({tabIdsInOrder}) {
        const order = {};

        for (const i in tabIdsInOrder) {
            order[tabIdsInOrder[i]] = i;
        }

        this.tabContexts.sort((a, b) => order[a.tabId] < order[b.tabId] ? -1 : 1);

        this.tabsUpdate.scheduleUpdate();
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

    beforeUnloadListener() {
        this.tabsUpdate.updateNowIfNecessary();
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
}