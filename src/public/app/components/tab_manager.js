import Component from "./component.js";
import SpacedUpdate from "../services/spaced_update.js";
import server from "../services/server.js";
import options from "../services/options.js";
import froca from "../services/froca.js";
import treeService from "../services/tree.js";
import utils from "../services/utils.js";
import NoteContext from "./note_context.js";
import appContext from "./app_context.js";
import Mutex from "../utils/mutex.js";

export default class TabManager extends Component {
    constructor() {
        super();

        this.mutex = new Mutex();

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
        try {
            const tabsToOpen = appContext.isMainWindow
                ? (options.getJson('openTabs') || [])
                : [];

            let filteredTabs = [];

            // preload all notes at once
            await froca.getNotes([
                    ...tabsToOpen.map(tab => treeService.getNoteIdFromNotePath(tab.notePath)),
                    ...tabsToOpen.map(tab => tab.hoistedNoteId),
            ], true);

            for (const openTab of tabsToOpen) {
                if (openTab.notePath && !(treeService.getNoteIdFromNotePath(openTab.notePath) in froca.notes)) {
                    // note doesn't exist so don't try to open tab for it
                    continue;
                }

                if (!(openTab.hoistedNoteId in froca.notes)) {
                    openTab.hoistedNoteId = 'root';
                }

                filteredTabs.push(openTab);
            }

            if (utils.isMobile()) {
                // mobile frontend doesn't have tabs so show only the active tab
                filteredTabs = filteredTabs.filter(tab => tab.active);
            }

            // resolve before opened tabs can change this
            const [notePathInUrl, ntxIdInUrl] = treeService.getHashValueFromAddress();

            if (filteredTabs.length === 0) {
                filteredTabs.push({
                    notePath: notePathInUrl || 'root',
                    active: true,
                    hoistedNoteId: glob.extraHoistedNoteId || 'root'
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

            // if there's notePath in the URL, make sure it's open and active
            // (useful, for e.g. opening clipped notes from clipper or opening link in an extra window)
            if (notePathInUrl) {
                await appContext.tabManager.switchToNoteContext(ntxIdInUrl, notePathInUrl);
            }
        }
        catch (e) {
            logError(`Loading tabs '${options.get('openTabs')}' failed: ${e.message} ${e.stack}`);

            // try to recover
            await this.openEmptyTab();
        }
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
            const url = `#${activeNoteContext.notePath || ""}-${activeNoteContext.ntxId}`;

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

    /** @returns {NoteContext[]} */
    getMainNoteContexts() {
        return this.noteContexts.filter(nc => nc.isMainContext());
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
    /** @returns {string|null} */
    getActiveContextNoteMime() {
        const activeNote = this.getActiveContextNote();

        return activeNote ? activeNote.mime : null;
    }

    async switchToNoteContext(ntxId, notePath) {
        const noteContext = this.noteContexts.find(nc => nc.ntxId === ntxId)
            || await this.openEmptyTab();

        await this.activateNoteContext(noteContext.ntxId);

        if (notePath) {
            await noteContext.setNote(notePath);
        }
    }

    async openAndActivateEmptyTab() {
        const noteContext = await this.openEmptyTab();

        await this.activateNoteContext(noteContext.ntxId);

        await noteContext.setEmpty();
    }

    async openEmptyTab(ntxId = null, hoistedNoteId = 'root', mainNtxId = null) {
        const noteContext = new NoteContext(ntxId, hoistedNoteId, mainNtxId);

        let existingNoteContext;

        if (utils.isMobile()) {
            // kind of hacky way to enforce a single tab on mobile interface - all requests to create a new one
            // are forced to reuse the existing ab instead
            existingNoteContext = this.getActiveContext();
        } else {
            existingNoteContext = this.children.find(nc => nc.ntxId === noteContext.ntxId);
        }

        if (existingNoteContext) {
            await existingNoteContext.setHoistedNoteId(hoistedNoteId);

            return existingNoteContext;
        }

        this.child(noteContext);

        await this.triggerEvent('newNoteContextCreated', {noteContext});

        return noteContext;
    }

    async openInNewTab(targetNoteId, hoistedNoteId = null) {
        const noteContext = await this.openEmptyTab(null, hoistedNoteId || this.getActiveContext().hoistedNoteId);

        await noteContext.setNote(targetNoteId);
    }

    async openInSameTab(targetNoteId, hoistedNoteId = null) {
        const activeContext = this.getActiveContext();
        await activeContext.setHoistedNoteId(hoistedNoteId || activeContext.hoistedNoteId);
        await activeContext.setNote(targetNoteId);
    }

    /**
     * If the requested notePath is within current note hoisting scope then keep the note hoisting also for the new tab.
     */
    async openTabWithNoteWithHoisting(notePath, activate = false) {
        const noteContext = this.getActiveContext();
        let hoistedNoteId = 'root';

        if (noteContext) {
            const resolvedNotePath = await treeService.resolveNotePath(notePath, noteContext.hoistedNoteId);

            if (resolvedNotePath.includes(noteContext.hoistedNoteId) || resolvedNotePath.includes('_hidden')) {
                hoistedNoteId = noteContext.hoistedNoteId;
            }
        }

        return this.openContextWithNote(notePath, activate, null, hoistedNoteId);
    }

    async openContextWithNote(notePath, activate, ntxId = null, hoistedNoteId = 'root', mainNtxId = null) {
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

    /**
     * @param ntxId
     * @returns {Promise<boolean>} true if note context has been removed, false otherwise
     */
    async removeNoteContext(ntxId) {
        // removing note context is async process which can take some time, if users presses CTRL-W quickly, two
        // close events could interleave which would then lead to attempting to activate already removed context.
        return await this.mutex.runExclusively(async () => {
            let noteContextToRemove;

            try {
                noteContextToRemove = this.getNoteContextById(ntxId);
            }
            catch {
                // note context not found
                return false;
            }

            if (noteContextToRemove.isMainContext()) {
                const mainNoteContexts = this.getNoteContexts().filter(nc => nc.isMainContext());

                if (mainNoteContexts.length === 1) {
                    if (noteContextToRemove.isEmpty()) {
                        // this is already the empty note context, no point in closing it and replacing with another
                        // empty tab
                        return false;
                    }

                    await this.openEmptyTab();
                }
            }

            // close dangling autocompletes after closing the tab
            $(".aa-input").autocomplete("close");

            const noteContextsToRemove = noteContextToRemove.getSubContexts();
            const ntxIdsToRemove = noteContextsToRemove.map(nc => nc.ntxId);

            await this.triggerEvent('beforeNoteContextRemove', { ntxIds: ntxIdsToRemove });

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

            this.removeNoteContexts(noteContextsToRemove);

            return true;
        });
    }

    removeNoteContexts(noteContextsToRemove) {
        const ntxIdsToRemove = noteContextsToRemove.map(nc => nc.ntxId);

        this.children = this.children.filter(nc => !ntxIdsToRemove.includes(nc.ntxId));

        this.addToRecentlyClosedTabs(noteContextsToRemove);

        this.triggerEvent('noteContextRemoved', {ntxIds: ntxIdsToRemove});

        this.tabsUpdate.scheduleUpdate();
    }

    addToRecentlyClosedTabs(noteContexts) {
        if (noteContexts.length === 1 && noteContexts[0].isEmpty()) {
            return;
        }

        this.recentlyClosedTabs.push(noteContexts);
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

    async closeAllTabsCommand() {
        for (const ntxIdToRemove of this.mainNoteContexts.map(nc => nc.ntxId)) {
            await this.removeNoteContext(ntxIdToRemove);
        }
    }

    async closeOtherTabsCommand({ntxId}) {
        for (const ntxIdToRemove of this.mainNoteContexts.map(nc => nc.ntxId)) {
            if (ntxIdToRemove !== ntxId) {
                await this.removeNoteContext(ntxIdToRemove);
            }
        }
    }

    async closeTabCommand({ntxId}) {
        await this.removeNoteContext(ntxId);
    }

    async moveTabToNewWindowCommand({ntxId}) {
        const {notePath, hoistedNoteId} = this.getNoteContextById(ntxId);

        const removed = await this.removeNoteContext(ntxId);

        if (removed) {
            this.triggerCommand('openInWindow', {notePath, hoistedNoteId});
        }
    }

    async reopenLastTabCommand() {
        let closeLastEmptyTab = null;

        await this.mutex.runExclusively(async () => {
            if (this.recentlyClosedTabs.length === 0) {
                return;
            }

            if (this.noteContexts.length === 1 && this.noteContexts[0].isEmpty()) {
                // new empty tab is created after closing the last tab, this reverses the empty tab creation
                closeLastEmptyTab = this.noteContexts[0];
            }

            const noteContexts = this.recentlyClosedTabs.pop();

            for (const noteContext of noteContexts) {
                this.child(noteContext);

                await this.triggerEvent('newNoteContextCreated', {noteContext});
            }

            const noteContextToActivate = noteContexts.length === 1
                ? noteContexts[0]
                : noteContexts.find(nc => nc.isMainContext());

            await this.activateNoteContext(noteContextToActivate.ntxId);

            await this.triggerEvent('noteSwitched', {
                noteContext: noteContextToActivate,
                notePath: noteContextToActivate.notePath
            });
        });

        if (closeLastEmptyTab) {
            await this.removeNoteContext(closeLastEmptyTab.ntxId);
        }
    }

    hoistedNoteChangedEvent() {
        this.tabsUpdate.scheduleUpdate();
    }

    updateDocumentTitle(activeNoteContext) {
        const titleFragments = [
            // it helps to navigate in history if note title is included in the title
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
