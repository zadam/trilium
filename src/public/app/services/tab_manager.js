import Component from "../widgets/component.js";
import SpacedUpdate from "./spaced_update.js";
import server from "./server.js";
import options from "./options.js";
import froca from "./froca.js";
import treeService from "./tree.js";
import utils from "./utils.js";
import NoteContext from "./note_context.js";
import appContext from "./app_context.js";

export default class TabManager extends Component {
    constructor() {
        super();

        this.activeNtxId = null;

        // elements are arrays of note contexts for each tab (one main context + subcontexts [splits])
        this.recentlyClosedTabs = [];

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

        await this.tabsUpdate.allowUpdateWithoutChange(async () => {
            for (const tab of filteredTabs) {
                await this.openContextWithNote(tab.notePath, tab.active, tab.ntxId, tab.hoistedNoteId, tab.mainNtxId);
            }
        });
    }

    noteSwitchedEvent({noteContext}) {
        if (noteContext.isActive()) {
            this.setCurrentNotePathToHash();
        }

        this.tabsUpdate.scheduleUpdate();
    }

    setCurrentNotePathToHash() {
        const activeNoteContext = this.getActiveContext();

        if (window.history.length === 0 // first history entry
            || (activeNoteContext && activeNoteContext.notePath !== treeService.getHashValueFromAddress()[0])) {
            const url = '#' + (activeNoteContext.notePath || "") + "-" + activeNoteContext.ntxId;

            // using pushState instead of directly modifying document.location because it does not trigger hashchange
            window.history.pushState(null, "", url);
        }

        this.updateDocumentTitle(activeNoteContext);

        this.triggerEvent('activeNoteChanged'); // trigger this even in on popstate event
    }

    /** @returns {NoteContext[]} */
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
    getActiveContext() {
        return this.activeNtxId
            ? this.getNoteContextById(this.activeNtxId)
            : null;
    }

    /** @returns {NoteContext} */
    getActiveMainContext() {
        return this.activeNtxId
            ? this.getNoteContextById(this.activeNtxId).getMainContext()
            : null;
    }

    /** @returns {string|null} */
    getActiveContextNotePath() {
        const activeContext = this.getActiveContext();
        return activeContext ? activeContext.notePath : null;
    }

    /** @returns {NoteShort} */
    getActiveContextNote() {
        const activeContext = this.getActiveContext();
        return activeContext ? activeContext.note : null;
    }

    /** @returns {string|null} */
    getActiveContextNoteId() {
        const activeNote = this.getActiveContextNote();

        return activeNote ? activeNote.noteId : null;
    }

    /** @returns {string|null} */
    getActiveContextNoteType() {
        const activeNote = this.getActiveContextNote();

        return activeNote ? activeNote.type : null;
    }

    async switchToNoteContext(ntxId, notePath) {
        const noteContext = this.noteContexts.find(nc => nc.ntxId === ntxId)
            || await this.openEmptyTab();

        this.activateNoteContext(noteContext.ntxId);
        await noteContext.setNote(notePath);
    }

    async openAndActivateEmptyTab() {
        const noteContext = await this.openEmptyTab();

        await this.activateNoteContext(noteContext.ntxId);

        await noteContext.setEmpty();
    }

    async openEmptyTab(ntxId, hoistedNoteId = 'root', mainNtxId = null) {
        const noteContext = new NoteContext(ntxId, hoistedNoteId, mainNtxId);

        const existingNoteContext = this.children.find(nc => nc.ntxId === noteContext.ntxId);

        if (existingNoteContext) {
            return existingNoteContext;
        }

        this.child(noteContext);

        await this.triggerEvent('newNoteContextCreated', {noteContext});

        return noteContext;
    }

    /**
     * If the requested notePath is within current note hoisting scope then keep the note hoisting also for the new tab.
     */
    async openTabWithNoteWithHoisting(notePath, activate = false) {
        const noteContext = this.getActiveContext();
        let hoistedNoteId = 'root';

        if (noteContext) {
            const resolvedNotePath = await treeService.resolveNotePath(notePath, noteContext.hoistedNoteId);

            if (resolvedNotePath.includes(noteContext.hoistedNoteId) || resolvedNotePath.includes("hidden")) {
                hoistedNoteId = noteContext.hoistedNoteId;
            }
        }

        return this.openContextWithNote(notePath, activate, null, hoistedNoteId);
    }

    async openContextWithNote(notePath, activate, ntxId, hoistedNoteId = 'root', mainNtxId = null) {
        const noteContext = await this.openEmptyTab(ntxId, hoistedNoteId, mainNtxId);

        if (notePath) {
            await noteContext.setNote(notePath, !activate); // if activate is false then send normal noteSwitched event
        }

        if (activate) {
            this.activateNoteContext(noteContext.ntxId, false);

            await this.triggerEvent('noteSwitchedAndActivated', {
                noteContext,
                notePath: noteContext.notePath // resolved note path
            });
        }

        return noteContext;
    }

    async activateOrOpenNote(noteId) {
        for (const noteContext of this.getNoteContexts()) {
            if (noteContext.note && noteContext.note.noteId === noteId) {
                this.activateNoteContext(noteContext.ntxId);

                return;
            }
        }

        // if no tab with this note has been found we'll create new tab

        await this.openContextWithNote(noteId, true);
    }

    async activateNoteContext(ntxId, triggerEvent = true) {
        if (ntxId === this.activeNtxId) {
            return;
        }

        this.activeNtxId = ntxId;

        if (triggerEvent) {
            await this.triggerEvent('activeContextChanged', {
                noteContext: this.getNoteContextById(ntxId)
            });
        }

        this.tabsUpdate.scheduleUpdate();

        this.setCurrentNotePathToHash();
    }

    async removeNoteContext(ntxId) {
        const noteContextToRemove = this.getNoteContextById(ntxId);

        if (noteContextToRemove.isMainContext()) {
            // forbid removing last main note context
            // this was previously allowed (was replaced with empty tab) but this proved to be prone to race conditions
            const mainNoteContexts = this.getNoteContexts().filter(nc => nc.isMainContext());

            if (mainNoteContexts.length === 1) {
                mainNoteContexts[0].setEmpty();
                return;
            }
        }

        // close dangling autocompletes after closing the tab
        $(".aa-input").autocomplete("close");

        const noteContextsToRemove = noteContextToRemove.getSubContexts();
        const ntxIdsToRemove = noteContextsToRemove.map(nc => nc.ntxId);

        await this.triggerEvent('beforeTabRemove', { ntxIds: ntxIdsToRemove });

        if (!noteContextToRemove.isMainContext()) {
            await this.activateNoteContext(noteContextToRemove.getMainContext().ntxId);
        }
        else if (this.mainNoteContexts.length <= 1) {
            await this.openAndActivateEmptyTab();
        }
        else if (ntxIdsToRemove.includes(this.activeNtxId)) {
            const idx = this.mainNoteContexts.findIndex(nc => nc.ntxId === noteContextToRemove.ntxId);

            if (idx === this.mainNoteContexts.length - 1) {
                await this.activatePreviousTabCommand();
            }
            else {
                await this.activateNextTabCommand();
            }
        }

        this.children = this.children.filter(nc => !ntxIdsToRemove.includes(nc.ntxId));

        this.recentlyClosedTabs.push(noteContextsToRemove);

        this.triggerEvent('noteContextRemoved', {ntxIds: ntxIdsToRemove});

        this.tabsUpdate.scheduleUpdate();
    }

    tabReorderEvent({ntxIdsInOrder}) {
        const order = {};

        let i = 0;

        for (const ntxId of ntxIdsInOrder) {
            for (const noteContext of this.getNoteContextById(ntxId).getSubContexts()) {
                order[noteContext.ntxId] = i++;
            }
        }

        this.children.sort((a, b) => order[a.ntxId] < order[b.ntxId] ? -1 : 1);

        this.tabsUpdate.scheduleUpdate();
    }

    noteContextReorderEvent({ntxIdsInOrder}) {
        const order = {};
        let i = 0;

        for (const ntxId of ntxIdsInOrder) {
            order[ntxId] = i++;
        }

        this.children.sort((a, b) => order[a.ntxId] < order[b.ntxId] ? -1 : 1);

        this.tabsUpdate.scheduleUpdate();
    }

    async activateNextTabCommand() {
        const activeMainNtxId = this.getActiveMainContext().ntxId;

        const oldIdx = this.mainNoteContexts.findIndex(nc => nc.ntxId === activeMainNtxId);
        const newActiveNtxId = this.mainNoteContexts[oldIdx === this.mainNoteContexts.length - 1 ? 0 : oldIdx + 1].ntxId;

        await this.activateNoteContext(newActiveNtxId);
    }

    async activatePreviousTabCommand() {
        const activeMainNtxId = this.getActiveMainContext().ntxId;

        const oldIdx = this.mainNoteContexts.findIndex(nc => nc.ntxId === activeMainNtxId);
        const newActiveNtxId = this.mainNoteContexts[oldIdx === 0 ? this.mainNoteContexts.length - 1 : oldIdx - 1].ntxId;

        await this.activateNoteContext(newActiveNtxId);
    }

    async closeActiveTabCommand() {
        await this.removeNoteContext(this.activeNtxId);
    }

    beforeUnloadEvent() {
        this.tabsUpdate.updateNowIfNecessary();

        return true; // don't block closing the tab, this metadata is not that important
    }

    openNewTabCommand() {
        this.openAndActivateEmptyTab();
    }

    async removeAllTabsCommand() {
        for (const ntxIdToRemove of this.mainNoteContexts.map(nc => nc.ntxId)) {
            await this.removeNoteContext(ntxIdToRemove);
        }
    }

    async removeAllTabsExceptForThisCommand({ntxId}) {
        for (const ntxIdToRemove of this.mainNoteContexts.map(nc => nc.ntxId)) {
            if (ntxIdToRemove !== ntxId) {
                await this.removeNoteContext(ntxIdToRemove);
            }
        }
    }

    moveTabToNewWindowCommand({ntxId}) {
        const {notePath, hoistedNoteId} = this.getNoteContextById(ntxId);

        this.removeNoteContext(ntxId);

        this.triggerCommand('openInWindow', {notePath, hoistedNoteId});
    }

    async reopenLastTabCommand() {
        if (this.recentlyClosedTabs.length > 0) {
            const noteContexts = this.recentlyClosedTabs.pop();

            for (const noteContext of noteContexts) {
                this.child(noteContext);

                await this.triggerEvent('newNoteContextCreated', {noteContext});
            }

            const noteContextToActivate = noteContexts.length === 1
                ? noteContexts[0]
                : noteContexts.find(nc => nc.isMainContext());

            this.activateNoteContext(noteContextToActivate.ntxId);

            await this.triggerEvent('noteSwitched', {
                noteContext: noteContextToActivate,
                notePath: noteContextToActivate.notePath
            });
        }
    }

    hoistedNoteChangedEvent() {
        this.tabsUpdate.scheduleUpdate();
    }

    updateDocumentTitle(activeNoteContext) {
        const titleFragments = [
            // it helps navigating in history if note title is included in the title
            activeNoteContext.note?.title,
            "Trilium Notes"
        ].filter(Boolean);

        document.title = titleFragments.join(" - ");
    }

    entitiesReloadedEvent({loadResults}) {
        const activeContext = this.getActiveContext();

        if (activeContext && loadResults.isNoteReloaded(activeContext.noteId)) {
            this.updateDocumentTitle(activeContext);
        }
    }
}
