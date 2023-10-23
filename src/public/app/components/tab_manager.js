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
import linkService from "../services/link.js";

export default class TabManager extends Component {
    constructor() {
        super();

        /** @property {NoteContext[]} */
        this.children = [];
        this.mutex = new Mutex();

        this.activeNtxId = null;

        // elements are arrays of {contexts, position}, storing note contexts for each tab (one main context + subcontexts [splits]), and the original position of the tab
        this.recentlyClosedTabs = [];

        this.tabsUpdate = new SpacedUpdate(async () => {
            if (!appContext.isMainWindow) {
                return;
            }

            const openNoteContexts = this.noteContexts
                .map(nc => nc.getPojoState())
                .filter(t => !!t);

            await server.put('options', {
                openNoteContexts: JSON.stringify(openNoteContexts)
            });
        });

        appContext.addBeforeUnloadListener(this);
    }

    /** @returns {NoteContext[]} */
    get noteContexts() {
        return this.children;
    }

    /** @type {NoteContext[]} */
    get mainNoteContexts() {
        return this.noteContexts.filter(nc => !nc.mainNtxId)
    }

    async loadTabs() {
        try {
            const noteContextsToOpen = (appContext.isMainWindow && options.getJson('openNoteContexts')) || [];

            // preload all notes at once
            await froca.getNotes([
                    ...noteContextsToOpen.flatMap(tab =>
                        [ treeService.getNoteIdFromUrl(tab.notePath), tab.hoistedNoteId]
                    ),
            ], true);

            const filteredNoteContexts = noteContextsToOpen.filter(openTab => {
                if (utils.isMobile()) { // mobile frontend doesn't have tabs so show only the active tab
                    return !!openTab.active;
                }

                const noteId = treeService.getNoteIdFromUrl(openTab.notePath);
                if (!(noteId in froca.notes)) {
                    // note doesn't exist so don't try to open tab for it
                    return false;
                }

                if (!(openTab.hoistedNoteId in froca.notes)) {
                    openTab.hoistedNoteId = 'root';
                }

                return true;
            });

            // resolve before opened tabs can change this
            const parsedFromUrl = linkService.parseNavigationStateFromUrl(window.location.href);

            if (filteredNoteContexts.length === 0) {
                parsedFromUrl.ntxId = parsedFromUrl.ntxId || NoteContext.generateNtxId(); // generate already here, so that we later know which one to activate

                filteredNoteContexts.push({
                    notePath: parsedFromUrl.notePath || 'root',
                    ntxId: parsedFromUrl.ntxId,
                    active: true,
                    hoistedNoteId: parsedFromUrl.hoistedNoteId || 'root',
                    viewScope: parsedFromUrl.viewScope || {}
                });
            } else if (!filteredNoteContexts.find(tab => tab.active)) {
                filteredNoteContexts[0].active = true;
            }

            await this.tabsUpdate.allowUpdateWithoutChange(async () => {
                for (const tab of filteredNoteContexts) {
                    await this.openContextWithNote(tab.notePath, {
                        activate: tab.active,
                        ntxId: tab.ntxId,
                        mainNtxId: tab.mainNtxId,
                        hoistedNoteId: tab.hoistedNoteId,
                        viewScope: tab.viewScope
                    });
                }
            });

            // if there's a notePath in the URL, make sure it's open and active
            // (useful, for e.g., opening clipped notes from clipper or opening link in an extra window)
            if (parsedFromUrl.notePath) {
                await appContext.tabManager.switchToNoteContext(
                    parsedFromUrl.ntxId,
                    parsedFromUrl.notePath,
                    parsedFromUrl.viewScope,
                    parsedFromUrl.hoistedNoteId
                );
            } else if (parsedFromUrl.searchString) {
                await appContext.triggerCommand('searchNotes', {
                    searchString: parsedFromUrl.searchString
                });
            }
        }
        catch (e) {
            logError(`Loading note contexts '${options.get('openNoteContexts')}' failed: ${e.message} ${e.stack}`);

            // try to recover
            await this.openEmptyTab();
        }
    }

    noteSwitchedEvent({noteContext}) {
        if (noteContext.isActive()) {
            this.setCurrentNavigationStateToHash();
        }

        this.tabsUpdate.scheduleUpdate();
    }

    setCurrentNavigationStateToHash() {
        const calculatedHash = this.calculateHash();

        // update if it's the first history entry or there has been a change
        if (window.history.length === 0 || calculatedHash !== window.location?.hash) {
            // using pushState instead of directly modifying document.location because it does not trigger hashchange
            window.history.pushState(null, "", calculatedHash);
        }

        const activeNoteContext = this.getActiveContext();
        this.updateDocumentTitle(activeNoteContext);

        this.triggerEvent('activeNoteChanged'); // trigger this even in on popstate event
    }

    calculateHash() {
        const activeNoteContext = this.getActiveContext();
        if (!activeNoteContext) {
            return "";
        }

        return linkService.calculateHash({
            notePath: activeNoteContext.notePath,
            ntxId: activeNoteContext.ntxId,
            hoistedNoteId: activeNoteContext.hoistedNoteId,
            viewScope: activeNoteContext.viewScope
        });
    }

    /** @returns {NoteContext[]} */
    getNoteContexts() {
        return this.noteContexts;
    }

    /**
     * Main context is essentially a tab (children are splits), so this returns tabs.
     * @returns {NoteContext[]}
     */
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

    /**
     * Get active context which represents the visible split with focus. Active context can, but doesn't have to be "main".
     *
     * @returns {NoteContext}
     */
    getActiveContext() {
        return this.activeNtxId
            ? this.getNoteContextById(this.activeNtxId)
            : null;
    }

    /**
     * Get active main context which corresponds to the active tab.
     *
     * @returns {NoteContext}
     */
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

    /** @returns {FNote} */
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

    async switchToNoteContext(ntxId, notePath, viewScope = {}, hoistedNoteId = null) {
        const noteContext = this.noteContexts.find(nc => nc.ntxId === ntxId)
            || await this.openEmptyTab();

        await this.activateNoteContext(noteContext.ntxId);

        if (hoistedNoteId) {
            await noteContext.setHoistedNoteId(hoistedNoteId);
        }

        if (notePath) {
            await noteContext.setNote(notePath, { viewScope });
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
    async openTabWithNoteWithHoisting(notePath, opts = {}) {
        const noteContext = this.getActiveContext();
        let hoistedNoteId = 'root';

        if (noteContext) {
            const resolvedNotePath = await treeService.resolveNotePath(notePath, noteContext.hoistedNoteId);

            if (resolvedNotePath.includes(noteContext.hoistedNoteId) || resolvedNotePath.includes('_hidden')) {
                hoistedNoteId = noteContext.hoistedNoteId;
            }
        }

        opts.hoistedNoteId = hoistedNoteId;

        return this.openContextWithNote(notePath, opts);
    }

    async openContextWithNote(notePath, opts = {}) {
        const activate = !!opts.activate;
        const ntxId = opts.ntxId || null;
        const mainNtxId = opts.mainNtxId || null;
        const hoistedNoteId = opts.hoistedNoteId || 'root';
        const viewScope = opts.viewScope || { viewMode: "default" };

        const noteContext = await this.openEmptyTab(ntxId, hoistedNoteId, mainNtxId);

        if (notePath) {
            await noteContext.setNote(notePath, {
                // if activate is false, then send normal noteSwitched event
                triggerSwitchEvent: !activate,
                viewScope: viewScope
            });
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

        await this.openContextWithNote(noteId, { activate: true });
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

        this.setCurrentNavigationStateToHash();
    }

    /**
     * @param ntxId
     * @returns {Promise<boolean>} true if note context has been removed, false otherwise
     */
    async removeNoteContext(ntxId) {
        // removing note context is an async process which can take some time, if users presses CTRL-W quickly, two
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
                const siblings = noteContextToRemove.getMainContext().getSubContexts();
                const idx = siblings.findIndex(nc => nc.ntxId === noteContextToRemove.ntxId);
                const contextToActivateIdx = idx === siblings.length - 1 ? idx - 1 : idx + 1;
                const contextToActivate = siblings[contextToActivateIdx];

                await this.activateNoteContext(contextToActivate.ntxId);
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

        const position = this.noteContexts.findIndex(nc => ntxIdsToRemove.includes(nc.ntxId));

        this.children = this.children.filter(nc => !ntxIdsToRemove.includes(nc.ntxId));

        this.addToRecentlyClosedTabs(noteContextsToRemove, position);

        this.triggerEvent('noteContextRemoved', {ntxIds: ntxIdsToRemove});

        this.tabsUpdate.scheduleUpdate();
    }

    addToRecentlyClosedTabs(noteContexts, position) {
        if (noteContexts.length === 1 && noteContexts[0].isEmpty()) {
            return;
        }

        this.recentlyClosedTabs.push({contexts: noteContexts, position: position});
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

    noteContextReorderEvent({ntxIdsInOrder, oldMainNtxId, newMainNtxId}) {
        const order = Object.fromEntries(ntxIdsInOrder.map((v, i) => [v, i]));

        this.children.sort((a, b) => order[a.ntxId] < order[b.ntxId] ? -1 : 1);

        if (oldMainNtxId && newMainNtxId) {
            this.children.forEach(c => {
                if (c.ntxId === newMainNtxId) {
                    // new main context has null mainNtxId
                    c.mainNtxId = null;
                } else if (c.ntxId === oldMainNtxId || c.mainNtxId === oldMainNtxId) {
                    // old main context or subcontexts all have the new mainNtxId
                    c.mainNtxId = newMainNtxId;
                }
            });
        }

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

            const lastClosedTab = this.recentlyClosedTabs.pop();
            const noteContexts = lastClosedTab.contexts;

            for (const noteContext of noteContexts) {
                this.child(noteContext);

                await this.triggerEvent('newNoteContextCreated', {noteContext});
            }

            //  restore last position of contexts stored in tab manager
            const ntxsInOrder = [
                ...this.noteContexts.slice(0, lastClosedTab.position),
                ...this.noteContexts.slice(-noteContexts.length),
                ...this.noteContexts.slice(lastClosedTab.position, -noteContexts.length),
            ]
            await this.noteContextReorderEvent({ntxIdsInOrder: ntxsInOrder.map(nc => nc.ntxId)});

            let mainNtx = noteContexts.find(nc => nc.isMainContext());
            if (mainNtx) {
                // reopened a tab, need to reorder new tab widget in tab row
                await this.triggerEvent('contextsReopened', {
                    mainNtxId: mainNtx.ntxId,
                    tabPosition: ntxsInOrder.filter(nc => nc.isMainContext()).findIndex(nc => nc.ntxId === mainNtx.ntxId)
                });
            } else {
                // reopened a single split, need to reorder the pane widget in split note container
                await this.triggerEvent('contextsReopened', {
                    ntxId: ntxsInOrder[lastClosedTab.position].ntxId,
                    // this is safe since lastClosedTab.position can never be 0 in this case
                    afterNtxId: ntxsInOrder[lastClosedTab.position - 1].ntxId
                });
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

    async updateDocumentTitle(activeNoteContext) {
        const titleFragments = [
            // it helps to navigate in history if note title is included in the title
            await activeNoteContext.getNavigationTitle(),
            "Trilium Notes"
        ].filter(Boolean);

        document.title = titleFragments.join(" - ");
    }

    async entitiesReloadedEvent({loadResults}) {
        const activeContext = this.getActiveContext();

        if (activeContext && loadResults.isNoteReloaded(activeContext.noteId)) {
            await this.updateDocumentTitle(activeContext);
        }
    }

    async frocaReloadedEvent() {
        const activeContext = this.getActiveContext();

        if (activeContext) {
            await this.updateDocumentTitle(activeContext);
        }
    }
}
