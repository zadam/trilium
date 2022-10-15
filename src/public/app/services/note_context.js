import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import utils from "./utils.js";
import appContext from "./app_context.js";
import treeService from "./tree.js";
import Component from "../widgets/component.js";
import froca from "./froca.js";
import hoistedNoteService from "./hoisted_note.js";
import options from "./options.js";

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
        this.notePath = null;
        this.noteId = null;
        this.parentNoteId = null;
        this.hoistedNoteId = 'root';

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
        ({noteId: this.noteId, parentNoteId: this.parentNoteId} = treeService.getNoteIdAndParentIdFromNotePath(resolvedNotePath));

        this.readOnlyTemporarilyDisabled = false;

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

    isMainContext() {
        // if null then this is a main context
        return !this.mainNtxId;
    }

    getMainContext() {
        if (this.mainNtxId) {
            try {
                return appContext.tabManager.getNoteContextById(this.mainNtxId);
            }
            catch (e) {
                this.mainNtxId = null;
                return this;
            }
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

    /** @returns {NoteComplement} */
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
        this.hoistedNoteId = noteIdToHoist;

        if (!this.notePathArray?.includes(noteIdToHoist)) {
            await this.setNote(noteIdToHoist);
        }

        await this.triggerEvent('hoistedNoteChanged', {
            noteId: noteIdToHoist,
            ntxId: this.ntxId
        });
    }

    async isReadOnly() {
        if (this.readOnlyTemporarilyDisabled) {
            return false;
        }

        // "readOnly" is a state valid only for text/code notes
        if (!this.note || (this.note.type !== 'text' && this.note.type !== 'code')) {
            return false;
        }

        if (this.note.hasLabel('readOnly')) {
            return true;
        }

        const noteComplement = await this.getNoteComplement();

        const sizeLimit = this.note.type === 'text' ?
            options.getInt('autoReadonlySizeText')
                : options.getInt('autoReadonlySizeCode');

        return noteComplement.content
            && noteComplement.content.length > sizeLimit
            && !this.note.hasLabel('autoReadOnlyDisabled');
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            const note = loadResults.getEntity('notes', this.noteId);

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

    hasNoteList() {
        return this.note
            && this.note.hasChildren()
            && ['book', 'text', 'code'].includes(this.note.type)
            && this.note.mime !== 'text/x-sqlite;schema=trilium'
            && !this.note.hasLabel('hideChildrenOverview');
    }

    async getTextEditor(callback) {
        return new Promise(resolve => appContext.triggerCommand('executeWithTextEditor', {
            callback,
            resolve,
            ntxId: this.ntxId
        }));
    }

    async getCodeEditor() {
        return new Promise(resolve => appContext.triggerCommand('executeWithCodeEditor', {
            resolve,
            ntxId: this.ntxId
        }));
    }

    async getContentElement() {
        return new Promise(resolve => appContext.triggerCommand('executeWithContentElement', {
            resolve,
            ntxId: this.ntxId
        }));
    }

    async getTypeWidget() {
        return new Promise(resolve => appContext.triggerCommand('executeWithTypeWidget', {
            resolve,
            ntxId: this.ntxId
        }));
    }
}

export default NoteContext;
