import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import utils from "./utils.js";
import appContext from "./app_context.js";
import treeService from "./tree.js";
import Component from "../widgets/component.js";
import froca from "./froca.js";
import hoistedNoteService from "./hoisted_note.js";

class NoteContext extends Component {
    /**
     * @param {string|null} ntxId
     */
    constructor(ntxId = null, hoistedNoteId = 'root', mainNtxId = null) {
        super();

        this.ntxId = ntxId || utils.randomString(4);
        this.hoistedNoteId = hoistedNoteId;
        this.mainNtxId = mainNtxId;
    }

    setEmpty() {
        this.triggerEvent('noteSwitched', {
            noteContext: this,
            notePath: this.notePath
        });
    }

    async setNote(inputNotePath, triggerSwitchEvent = true) {
        const resolvedNotePath = await this.getResolvedNotePath(inputNotePath);

        if (!resolvedNotePath) {
            return;
        }

        await this.triggerEvent('beforeNoteSwitch', {noteContext: this});

        utils.closeActiveDialog();

        this.notePath = resolvedNotePath;
        this.noteId = treeService.getNoteIdFromNotePath(resolvedNotePath);

        this.textPreviewDisabled = false;
        this.codePreviewDisabled = false;

        this.saveToRecentNotes(resolvedNotePath);

        protectedSessionHolder.touchProtectedSessionIfNecessary(this.note);

        if (triggerSwitchEvent) {
            await this.triggerEvent('noteSwitched', {
                noteContext: this,
                notePath: this.notePath
            });
        }

        if (utils.isDesktop()) {
            // close dangling autocompletes after closing the tab
            $(".aa-input").autocomplete("close");
        }
    }

    getSubContexts() {
        return appContext.tabManager.noteContexts.filter(nc => nc.ntxId === this.ntxId || nc.mainNtxId === this.ntxId);
    }

    getMainContext() {
        if (this.mainNtxId) {
            return appContext.tabManager.getNoteContextById(this.mainNtxId);
        }
        else {
            return this;
        }
    }

    saveToRecentNotes(resolvedNotePath) {
        setTimeout(async () => {
            // we include the note into recent list only if the user stayed on the note at least 5 seconds
            if (resolvedNotePath && resolvedNotePath === this.notePath) {
                await server.post('recent-notes', {
                    noteId: this.note.noteId,
                    notePath: this.notePath
                });
            }
        }, 5000);
    }

    async getResolvedNotePath(inputNotePath) {
        const noteId = treeService.getNoteIdFromNotePath(inputNotePath);

        if ((await froca.getNote(noteId)).isDeleted) {
            // no point in trying to resolve canonical notePath
            return inputNotePath;
        }

        const resolvedNotePath = await treeService.resolveNotePath(inputNotePath, this.hoistedNoteId);

        if (!resolvedNotePath) {
            logError(`Cannot resolve note path ${inputNotePath}`);
            return;
        }

        if (resolvedNotePath === this.notePath) {
            return;
        }

        if (await hoistedNoteService.checkNoteAccess(resolvedNotePath, this) === false) {
            return; // note is outside of hoisted subtree and user chose not to unhoist
        }

        // if user choise to unhoist, cache was reloaded, but might not contain this note (since it's on unexpanded path)
        await froca.getNote(noteId);

        return resolvedNotePath;
    }

    /** @property {NoteShort} */
    get note() {
        if (!this.noteId || !(this.noteId in froca.notes)) {
            return null;
        }

        return froca.notes[this.noteId];
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

        return await froca.getNoteComplement(this.noteId);
    }

    isActive() {
        return appContext.tabManager.activeNtxId === this.ntxId;
    }

    getTabState() {
        if (!this.notePath) {
            return null;
        }

        return {
            ntxId: this.ntxId,
            mainNtxId: this.mainNtxId,
            notePath: this.notePath,
            hoistedNoteId: this.hoistedNoteId,
            active: this.isActive()
        }
    }

    async unhoist() {
        await this.setHoistedNoteId('root');
    }

    async setHoistedNoteId(noteIdToHoist) {
        if (this.notePathArray && !this.notePathArray.includes(noteIdToHoist)) {
            await this.setNote(noteIdToHoist);
        }

        this.hoistedNoteId = noteIdToHoist;

        await this.triggerEvent('hoistedNoteChanged', {
            noteId: noteIdToHoist,
            ntxId: this.ntxId
        });
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            const note = await froca.getNote(this.noteId);

            if (note.isDeleted) {
                this.noteId = null;
                this.notePath = null;

                this.triggerEvent('noteSwitched', {
                    noteContext: this,
                    notePath: this.notePath
                });
            }
        }
    }
}

export default NoteContext;
