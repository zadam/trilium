import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import utils from "./utils.js";
import appContext from "./app_context.js";
import treeService from "./tree.js";
import Component from "../widgets/component.js";
import treeCache from "./tree_cache.js";
import hoistedNoteService from "./hoisted_note.js";

class TabContext extends Component {
    /**
     * @param {string|null} tabId
     */
    constructor(tabId = null) {
        super();

        this.tabId = tabId || utils.randomString(4);
    }

    setEmpty() {
        this.triggerEvent('tabNoteSwitched', {
            tabContext: this,
            notePath: this.notePath
        });
    }

    async setNote(inputNotePath, triggerSwitchEvent = true) {
        const noteId = treeService.getNoteIdFromNotePath(inputNotePath);
        let resolvedNotePath;

        if ((await treeCache.getNote(noteId)).isDeleted) {
            // no point in trying to resolve canonical notePath
            resolvedNotePath = inputNotePath;
        }
        else {
            resolvedNotePath = await treeService.resolveNotePath(inputNotePath);

            if (!resolvedNotePath) {
                logError(`Cannot resolve note path ${inputNotePath}`);
                return;
            }

            if (resolvedNotePath === this.notePath) {
                return;
            }

            if (await hoistedNoteService.checkNoteAccess(resolvedNotePath) === false) {
                return; // note is outside of hoisted subtree and user chose not to unhoist
            }

            // if user choise to unhoist, cache was reloaded, but might not contain this note (since it's on unexpanded path)
            await treeCache.getNote(noteId);
        }

        await this.triggerEvent('beforeNoteSwitch', {tabContext: this});

        utils.closeActiveDialog();

        this.notePath = resolvedNotePath;
        this.noteId = noteId;

        this.autoBookDisabled = false;
        this.textPreviewDisabled = false;
        this.codePreviewDisabled = false;

        setTimeout(async () => {
            // we include the note into recent list only if the user stayed on the note at least 5 seconds
            if (resolvedNotePath && resolvedNotePath === this.notePath) {
                await server.post('recent-notes', {
                    noteId: this.note.noteId,
                    notePath: this.notePath
                });
            }
        }, 5000);

        protectedSessionHolder.touchProtectedSessionIfNecessary(this.note);

        if (triggerSwitchEvent) {
            await this.triggerEvent('tabNoteSwitched', {
                tabContext: this,
                notePath: this.notePath
            });
        }

        if (utils.isDesktop()) {
            // close dangling autocompletes after closing the tab
            $(".aa-input").autocomplete("close");
        }
    }

    /** @property {NoteShort} */
    get note() {
        if (this.noteId && !(this.noteId in treeCache.notes)) {
            logError(`Cannot find tabContext's note id='${this.noteId}'`);
        }

        return treeCache.notes[this.noteId];
    }

    /** @property {string[]} */
    get notePathArray() {
        return this.notePath ? this.notePath.split('/') : [];
    }

    /** @return {NoteComplement} */
    async getNoteComplement() {
        if (!this.noteId) {
            return null;
        }

        return await treeCache.getNoteComplement(this.noteId);
    }

    isActive() {
        return appContext.tabManager.activeTabId === this.tabId;
    }

    getTabState() {
        if (!this.notePath) {
            return null;
        }

        return {
            tabId: this.tabId,
            notePath: this.notePath,
            active: this.isActive()
        }
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            const note = await treeCache.getNote(this.noteId);

            if (note.isDeleted) {
                this.noteId = null;
                this.notePath = null;

                this.triggerEvent('tabNoteSwitched', {
                    tabContext: this,
                    notePath: this.notePath
                });
            }
        }
    }
}

export default TabContext;
