import Component from "../widgets/component.js";
import SpacedUpdate from "./spaced_update.js";
import server from "./server.js";
import options from "./options.js";
import froca from "./froca.js";
import treeService from "./tree.js";
import utils from "./utils.js";
import TabContext from "./tab_context.js";
import appContext from "./app_context.js";

export default class TabManager extends Component {
    constructor() {
        super();

        this.activeTabId = null;

        this.tabsUpdate = new SpacedUpdate(async () => {
            if (!appContext.isMainWindow) {
                return;
            }

            const openTabs = this.tabContexts
                .map(tc => tc.getTabState())
                .filter(t => !!t);

            await server.put('options', {
                openTabs: JSON.stringify(openTabs)
            });
        });

        appContext.addBeforeUnloadListener(this);
    }

    /** @type {TabContext[]} */
    get tabContexts() {
        return this.children;
    }

    /** @type {TabContext[]} */
    get mainTabContexts() {
        return this.tabContexts.filter(tc => !tc.parentTabId)
    }

    async loadTabs() {
        const tabsToOpen = appContext.isMainWindow
            ? (options.getJson('openTabs') || [])
            : [];

        // if there's notePath in the URL, make sure it's open and active
        // (useful, among others, for opening clipped notes from clipper)
        if (window.location.hash) {
            const notePath = window.location.hash.substr(1);
            const noteId = treeService.getNoteIdFromNotePath(notePath);

            if (noteId && await froca.noteExists(noteId)) {
                for (const tab of tabsToOpen) {
                    tab.active = false;
                }

                const foundTab = tabsToOpen.find(tab => noteId === treeService.getNoteIdFromNotePath(tab.notePath));

                if (foundTab) {
                    foundTab.active = true;
                }
                else {
                    tabsToOpen.push({
                        notePath: notePath,
                        active: true,
                        hoistedNoteId: glob.extraHoistedNoteId || 'root'
                    });
                }
            }
        }

        let filteredTabs = [];

        for (const openTab of tabsToOpen) {
            const noteId = treeService.getNoteIdFromNotePath(openTab.notePath);

            if (await froca.noteExists(noteId)) {
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
                notePath: this.isMainWindow ? 'root' : '',
                active: true,
                extraHoistedNoteId: glob.extraHoistedNoteId || 'root'
            });
        }

        if (!filteredTabs.find(tab => tab.active)) {
            filteredTabs[0].active = true;
        }

        await this.tabsUpdate.allowUpdateWithoutChange(async () => {
            for (const tab of filteredTabs) {
                await this.openTabWithNote(tab.notePath, tab.active, tab.tabId, tab.hoistedNoteId, tab.parentTabId);
            }
        });
    }

    tabNoteSwitchedEvent({tabContext}) {
        if (tabContext.isActive()) {
            this.setCurrentNotePathToHash();
        }

        this.tabsUpdate.scheduleUpdate();
    }

    setCurrentNotePathToHash() {
        const activeTabContext = this.getActiveTabContext();

        if (window.history.length === 0 // first history entry
            || (activeTabContext && activeTabContext.notePath !== treeService.getHashValueFromAddress()[0])) {
            const url = '#' + (activeTabContext.notePath || "") + "-" + activeTabContext.tabId;

            // using pushState instead of directly modifying document.location because it does not trigger hashchange
            window.history.pushState(null, "", url);
        }

        document.title = "Trilium Notes";

        if (activeTabContext.note) {
            // it helps navigating in history if note title is included in the title
            document.title += " - " + activeTabContext.note.title;
        }

        this.triggerEvent('activeNoteChanged'); // trigger this even in on popstate event
    }

    /** @return {TabContext[]} */
    getTabContexts() {
        return this.tabContexts;
    }

    /** @returns {TabContext} */
    getTabContextById(tabId) {
        const tabContext = this.tabContexts.find(tc => tc.tabId === tabId);

        if (!tabContext) {
            throw new Error(`Cannot find tabContext id='${tabId}'`);
        }

        return tabContext;
    }

    /** @returns {TabContext} */
    getActiveTabContext() {
        return this.activeTabId
            ? this.getTabContextById(this.activeTabId)
            : null;
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
            || await this.openEmptyTab();

        this.activateTab(tabContext.tabId);
        await tabContext.setNote(notePath);
    }

    async openAndActivateEmptyTab() {
        const tabContext = await this.openEmptyTab();

        await this.activateTab(tabContext.tabId);

        await tabContext.setEmpty();
    }

    async openEmptyTab(tabId, hoistedNoteId, parentTabId = null) {
        const tabContext = new TabContext(tabId, hoistedNoteId, parentTabId);
        this.child(tabContext);

        await this.triggerEvent('newTabOpened', {tabContext});

        return tabContext;
    }

    /**
     * If the requested notePath is within current note hoisting scope then keep the note hoisting also for the new tab.
     */
    async openTabWithNoteWithHoisting(notePath) {
        const tabContext = this.getActiveTabContext();
        let hoistedNoteId = 'root';

        if (tabContext) {
            const resolvedNotePath = await treeService.resolveNotePath(notePath, tabContext.hoistedNoteId);

            if (resolvedNotePath.includes(tabContext.hoistedNoteId)) {
                hoistedNoteId = tabContext.hoistedNoteId;
            }
        }

        return this.openTabWithNote(notePath, false, null, hoistedNoteId);
    }

    async openTabWithNote(notePath, activate, tabId, hoistedNoteId, parentTabId = null) {
        const tabContext = await this.openEmptyTab(tabId, hoistedNoteId, parentTabId);

        if (notePath) {
            await tabContext.setNote(notePath, !activate); // if activate is false then send normal noteSwitched event
        }

        if (activate) {
            this.activateTab(tabContext.tabId, false);

            await this.triggerEvent('tabNoteSwitchedAndActivated', {
                tabContext,
                notePath: tabContext.notePath // resolved note path
            });
        }

        return tabContext;
    }

    async activateOrOpenNote(noteId) {
        for (const tabContext of this.getTabContexts()) {
            if (tabContext.note && tabContext.note.noteId === noteId) {
                this.activateTab(tabContext.tabId);

                return;
            }
        }

        // if no tab with this note has been found we'll create new tab

        await this.openTabWithNote(noteId, true);
    }

    activateTab(tabId, triggerEvent = true) {
        if (tabId === this.activeTabId) {
            return;
        }

        this.activeTabId = tabId;

        if (triggerEvent) {
            this.triggerEvent('activeTabChanged', {
                tabContext: this.getTabContextById(tabId)
            });
        }

        this.tabsUpdate.scheduleUpdate();

        this.setCurrentNotePathToHash();
    }

    async removeTab(tabId) {
        let mainTabContextToRemove = this.getTabContextById(tabId);

        if (!mainTabContextToRemove) {
            return;
        }

        if (mainTabContextToRemove.parentTabId) {
            mainTabContextToRemove = this.getTabContextById(mainTabContextToRemove.parentTabId);
        }

        // close dangling autocompletes after closing the tab
        $(".aa-input").autocomplete("close");

        const tabIdsToRemove = mainTabContextToRemove.getAllSubTabContexts().map(tc => tc.tabId);

        await this.triggerEvent('beforeTabRemove', { tabIds: tabIdsToRemove });

        if (this.mainTabContexts.length <= 1) {
            await this.openAndActivateEmptyTab();
        }
        else if (tabIdsToRemove.includes(this.activeTabId)) {
            const idx = this.mainTabContexts.findIndex(tc => tc.tabId === mainTabContextToRemove.tabId);

            if (idx === this.mainTabContexts.length - 1) {
                this.activatePreviousTabCommand();
            }
            else {
                this.activateNextTabCommand();
            }
        }

        this.children = this.children.filter(tc => !tabIdsToRemove.includes(tc.tabId));

        this.triggerEvent('tabRemoved', {tabIds: tabIdsToRemove});

        this.tabsUpdate.scheduleUpdate();
    }

    tabReorderEvent({tabIdsInOrder}) {
        const order = {};

        for (const i in tabIdsInOrder) {
            order[tabIdsInOrder[i]] = i;
        }

        this.children.sort((a, b) => order[a.tabId] < order[b.tabId] ? -1 : 1);

        this.tabsUpdate.scheduleUpdate();
    }

    activateNextTabCommand() {
        const oldIdx = this.mainTabContexts.findIndex(tc => tc.tabId === this.activeTabId);
        const newActiveTabId = this.mainTabContexts[oldIdx === this.tabContexts.length - 1 ? 0 : oldIdx + 1].tabId;

        this.activateTab(newActiveTabId);
    }

    activatePreviousTabCommand() {
        const oldIdx = this.mainTabContexts.findIndex(tc => tc.tabId === this.activeTabId);
        const newActiveTabId = this.mainTabContexts[oldIdx === 0 ? this.tabContexts.length - 1 : oldIdx - 1].tabId;

        this.activateTab(newActiveTabId);
    }

    closeActiveTabCommand() {
        this.removeTab(this.activeTabId);
    }

    beforeUnloadEvent() {
        this.tabsUpdate.updateNowIfNecessary();

        return true; // don't block closing the tab, this metadata is not that important
    }

    openNewTabCommand() {
        this.openAndActivateEmptyTab();
    }

    async removeAllTabsCommand() {
        for (const tabIdToRemove of this.tabContexts.map(tc => tc.tabId)) {
            await this.removeTab(tabIdToRemove);
        }
    }

    async removeAllTabsExceptForThisCommand({tabId}) {
        for (const tabIdToRemove of this.tabContexts.map(tc => tc.tabId)) {
            if (tabIdToRemove !== tabId) {
                await this.removeTab(tabIdToRemove);
            }
        }
    }

    moveTabToNewWindowCommand({tabId}) {
        const {notePath, hoistedNoteId} = this.getTabContextById(tabId);

        this.removeTab(tabId);

        this.triggerCommand('openInWindow', {notePath, hoistedNoteId});
    }

    hoistedNoteChangedEvent() {
        this.tabsUpdate.scheduleUpdate();
    }
}
