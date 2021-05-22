import Component from "../widgets/component.js";
import SpacedUpdate from "./spaced_update.js";
import server from "./server.js";
import options from "./options.js";
import froca from "./froca.js";
import treeService from "./tree.js";
import utils from "./utils.js";
import NoteContext from "./tab_context.js";
import appContext from "./app_context.js";

export default class TabManager extends Component {
    constructor() {
        super();

        this.activeTabId = null;

        this.tabsUpdate = new SpacedUpdate(async () => {
            if (!appContext.isMainWindow) {
                return;
            }

            const openTabs = this.noteContexts
                .map(nc => nc.getTabState())
                .filter(t => !!t);

            await server.put('options', {
                openTabs: JSON.stringify(openTabs)
            });
        });

        appContext.addBeforeUnloadListener(this);
    }

    /** @type {NoteContext[]} */
    get noteContexts() {
        return this.children;
    }

    /** @type {NoteContext[]} */
    get mainNoteContexts() {
        return this.noteContexts.filter(nc => !nc.mainNtxId)
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

        console.log("filteredTabs", filteredTabs);

        await this.tabsUpdate.allowUpdateWithoutChange(async () => {
            for (const tab of filteredTabs) {
                await this.openTabWithNote(tab.notePath, tab.active, tab.ntxId, tab.hoistedNoteId, tab.mainNtxId);
            }
        });
    }

    tabNoteSwitchedEvent({noteContext}) {
        if (noteContext.isActive()) {
            this.setCurrentNotePathToHash();
        }

        this.tabsUpdate.scheduleUpdate();
    }

    setCurrentNotePathToHash() {
        const activeNoteContext = this.getActiveNoteContext();

        if (window.history.length === 0 // first history entry
            || (activeNoteContext && activeNoteContext.notePath !== treeService.getHashValueFromAddress()[0])) {
            const url = '#' + (activeNoteContext.notePath || "") + "-" + activeNoteContext.ntxId;

            // using pushState instead of directly modifying document.location because it does not trigger hashchange
            window.history.pushState(null, "", url);
        }

        document.title = "Trilium Notes";

        if (activeNoteContext.note) {
            // it helps navigating in history if note title is included in the title
            document.title += " - " + activeNoteContext.note.title;
        }

        this.triggerEvent('activeNoteChanged'); // trigger this even in on popstate event
    }

    /** @return {NoteContext[]} */
    getNoteContexts() {
        return this.noteContexts;
    }

    /** @returns {NoteContext} */
    getNoteContextById(ntxId) {
        const noteContext = this.noteContexts.find(nc => nc.ntxId === ntxId);

        if (!noteContext) {
            throw new Error(`Cannot find noteContext id='${ntxId}'`);
        }

        return noteContext;
    }

    /** @returns {NoteContext} */
    getActiveNoteContext() {
        return this.activeTabId
            ? this.getNoteContextById(this.activeTabId)
            : null;
    }

    /** @returns {string|null} */
    getActiveTabNotePath() {
        const activeContext = this.getActiveNoteContext();
        return activeContext ? activeContext.notePath : null;
    }

    /** @return {NoteShort} */
    getActiveTabNote() {
        const activeContext = this.getActiveNoteContext();
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

    async switchToTab(ntxId, notePath) {
        const noteContext = this.noteContexts.find(nc => nc.ntxId === ntxId)
            || await this.openEmptyTab();

        this.activateTab(noteContext.ntxId);
        await noteContext.setNote(notePath);
    }

    async openAndActivateEmptyTab() {
        const noteContext = await this.openEmptyTab();

        await this.activateTab(noteContext.ntxId);

        await noteContext.setEmpty();
    }

    async openEmptyTab(ntxId, hoistedNoteId = 'root', mainNtxId = null) {
        const noteContext = new NoteContext(ntxId, hoistedNoteId, mainNtxId);

        const existingNoteContext = this.children.find(nc => nc.ntxId === noteContext.ntxId);

        if (existingNoteContext) {
            return existingNoteContext;
        }

        this.child(noteContext);

        await this.triggerEvent('newTabOpened', {noteContext});

        return noteContext;
    }

    /**
     * If the requested notePath is within current note hoisting scope then keep the note hoisting also for the new tab.
     */
    async openTabWithNoteWithHoisting(notePath) {
        const noteContext = this.getActiveNoteContext();
        let hoistedNoteId = 'root';

        if (noteContext) {
            const resolvedNotePath = await treeService.resolveNotePath(notePath, noteContext.hoistedNoteId);

            if (resolvedNotePath.includes(noteContext.hoistedNoteId)) {
                hoistedNoteId = noteContext.hoistedNoteId;
            }
        }

        return this.openTabWithNote(notePath, false, null, hoistedNoteId);
    }

    async openTabWithNote(notePath, activate, ntxId, hoistedNoteId = 'root', mainNtxId = null) {
        const noteContext = await this.openEmptyTab(ntxId, hoistedNoteId, mainNtxId);

        if (notePath) {
            await noteContext.setNote(notePath, !activate); // if activate is false then send normal noteSwitched event
        }

        if (activate) {
            this.activateTab(noteContext.ntxId, false);

            await this.triggerEvent('tabNoteSwitchedAndActivated', {
                noteContext,
                notePath: noteContext.notePath // resolved note path
            });
        }

        return noteContext;
    }

    async activateOrOpenNote(noteId) {
        for (const noteContext of this.getNoteContexts()) {
            if (noteContext.note && noteContext.note.noteId === noteId) {
                this.activateTab(noteContext.ntxId);

                return;
            }
        }

        // if no tab with this note has been found we'll create new tab

        await this.openTabWithNote(noteId, true);
    }

    activateTab(ntxId, triggerEvent = true) {
        if (ntxId === this.activeTabId) {
            return;
        }

        this.activeTabId = ntxId;

        if (triggerEvent) {
            this.triggerEvent('activeTabChanged', {
                noteContext: this.getNoteContextById(ntxId)
            });
        }

        this.tabsUpdate.scheduleUpdate();

        this.setCurrentNotePathToHash();
    }

    async removeTab(ntxId) {
        const mainNoteContextToRemove = this.getNoteContextById(ntxId).getMainNoteContext();

        // close dangling autocompletes after closing the tab
        $(".aa-input").autocomplete("close");

        const ntxIdsToRemove = mainNoteContextToRemove.getAllSubNoteContexts().map(nc => nc.ntxId);

        await this.triggerEvent('beforeTabRemove', { ntxIds: ntxIdsToRemove });

        if (this.mainNoteContexts.length <= 1) {
            await this.openAndActivateEmptyTab();
        }
        else if (ntxIdsToRemove.includes(this.activeTabId)) {
            const idx = this.mainNoteContexts.findIndex(nc => nc.ntxId === mainNoteContextToRemove.ntxId);

            if (idx === this.mainNoteContexts.length - 1) {
                this.activatePreviousTabCommand();
            }
            else {
                this.activateNextTabCommand();
            }
        }

        this.children = this.children.filter(nc => !ntxIdsToRemove.includes(nc.ntxId));

        this.triggerEvent('tabRemoved', {ntxIds: ntxIdsToRemove});

        this.tabsUpdate.scheduleUpdate();
    }

    tabReorderEvent({ntxIdsInOrder}) {
        const order = {};

        for (const i in ntxIdsInOrder) {
            order[ntxIdsInOrder[i]] = i;
        }

        this.children.sort((a, b) => order[a.ntxId] < order[b.ntxId] ? -1 : 1);

        this.tabsUpdate.scheduleUpdate();
    }

    activateNextTabCommand() {
        const oldIdx = this.mainNoteContexts.findIndex(nc => nc.ntxId === this.activeTabId);
        const newActiveTabId = this.mainNoteContexts[oldIdx === this.noteContexts.length - 1 ? 0 : oldIdx + 1].ntxId;

        this.activateTab(newActiveTabId);
    }

    activatePreviousTabCommand() {
        const oldIdx = this.mainNoteContexts.findIndex(nc => nc.ntxId === this.activeTabId);
        const newActiveTabId = this.mainNoteContexts[oldIdx === 0 ? this.noteContexts.length - 1 : oldIdx - 1].ntxId;

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
        for (const ntxIdToRemove of this.noteContexts.map(nc => nc.ntxId)) {
            await this.removeTab(ntxIdToRemove);
        }
    }

    async removeAllTabsExceptForThisCommand({ntxId}) {
        for (const ntxIdToRemove of this.noteContexts.map(nc => nc.ntxId)) {
            if (ntxIdToRemove !== ntxId) {
                await this.removeTab(ntxIdToRemove);
            }
        }
    }

    moveTabToNewWindowCommand({ntxId}) {
        const {notePath, hoistedNoteId} = this.getNoteContextById(ntxId);

        this.removeTab(ntxId);

        this.triggerCommand('openInWindow', {notePath, hoistedNoteId});
    }

    hoistedNoteChangedEvent() {
        this.tabsUpdate.scheduleUpdate();
    }
}
