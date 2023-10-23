import protectedSessionHolder from "../services/protected_session_holder.js";
import server from "../services/server.js";
import utils from "../services/utils.js";
import appContext from "./app_context.js";
import treeService from "../services/tree.js";
import Component from "./component.js";
import froca from "../services/froca.js";
import hoistedNoteService from "../services/hoisted_note.js";
import options from "../services/options.js";

class NoteContext extends Component {
    constructor(ntxId = null, hoistedNoteId = 'root', mainNtxId = null) {
        super();

        this.ntxId = ntxId || this.constructor.generateNtxId();
        this.hoistedNoteId = hoistedNoteId;
        this.mainNtxId = mainNtxId;

        this.resetViewScope();
    }

    static generateNtxId() {
        return utils.randomString(6);
    }

    setEmpty() {
        this.notePath = null;
        this.noteId = null;
        this.parentNoteId = null;
        // hoisted note is kept intentionally

        this.triggerEvent('noteSwitched', {
            noteContext: this,
            notePath: this.notePath
        });

        this.resetViewScope();
    }

    isEmpty() {
        return !this.noteId;
    }

    async setNote(inputNotePath, opts = {}) {
        opts.triggerSwitchEvent = opts.triggerSwitchEvent !== undefined ? opts.triggerSwitchEvent : true;
        opts.viewScope = opts.viewScope || {};
        opts.viewScope.viewMode = opts.viewScope.viewMode || "default";

        const resolvedNotePath = await this.getResolvedNotePath(inputNotePath);

        if (!resolvedNotePath) {
            return;
        }

        if (this.notePath === resolvedNotePath && utils.areObjectsEqual(this.viewScope, opts.viewScope)) {
            return;
        }

        await this.triggerEvent('beforeNoteSwitch', {noteContext: this});

        utils.closeActiveDialog();

        this.notePath = resolvedNotePath;
        this.viewScope = opts.viewScope;
        ({noteId: this.noteId, parentNoteId: this.parentNoteId} = treeService.getNoteIdAndParentIdFromUrl(resolvedNotePath));

        this.saveToRecentNotes(resolvedNotePath);

        protectedSessionHolder.touchProtectedSessionIfNecessary(this.note);

        if (opts.triggerSwitchEvent) {
            await this.triggerEvent('noteSwitched', {
                noteContext: this,
                notePath: this.notePath
            });
        }

        await this.setHoistedNoteIfNeeded();

        if (utils.isMobile()) {
            this.triggerCommand('setActiveScreen', {screen: 'detail'});
        }
    }

    async setHoistedNoteIfNeeded() {
        if (this.hoistedNoteId === 'root'
            && this.notePath.startsWith("root/_hidden")
            && !this.note.isLabelTruthy("keepCurrentHoisting")
        ) {
            // hidden subtree displays only when hoisted, so it doesn't make sense to keep root as hoisted note

            let hoistedNoteId = '_hidden';

            if (this.note.isLaunchBarConfig()) {
                hoistedNoteId = '_lbRoot';
            } else if (this.note.isOptions()) {
                hoistedNoteId = '_options';
            }

            await this.setHoistedNoteId(hoistedNoteId);
        }
    }

    getSubContexts() {
        return appContext.tabManager.noteContexts.filter(nc => nc.ntxId === this.ntxId || nc.mainNtxId === this.ntxId);
    }

    /**
     * A main context represents a tab and also the first split. Further splits are the children contexts of the main context.
     * Imagine you have a tab with 3 splits, each showing notes A, B, C (in this order).
     * In such a scenario, A context is the main context (also representing the tab as a whole), and B, C are the children
     * of context A.
     *
     * @returns {boolean} true if the context is main (= tab)
     */
    isMainContext() {
        // if null, then this is a main context
        return !this.mainNtxId;
    }

    /**
     * See docs for isMainContext() for better explanation.
     *
     * @returns {NoteContext}
     */
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
            // we include the note in the recent list only if the user stayed on the note at least 5 seconds
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

        if (await hoistedNoteService.checkNoteAccess(resolvedNotePath, this) === false) {
            return; // note is outside of hoisted subtree and user chose not to unhoist
        }

        return resolvedNotePath;
    }

    /** @returns {FNote} */
    get note() {
        if (!this.noteId || !(this.noteId in froca.notes)) {
            return null;
        }

        return froca.notes[this.noteId];
    }

    /** @returns {string[]} */
    get notePathArray() {
        return this.notePath ? this.notePath.split('/') : [];
    }

    isActive() {
        return appContext.tabManager.activeNtxId === this.ntxId;
    }

    getPojoState() {
        if (this.hoistedNoteId !== 'root') {
            // keeping empty hoisted tab is esp. important for mobile (e.g. opened launcher config)

            if (!this.notePath && this.getSubContexts().length === 0) {
                return null;
            }
        }

        return {
            ntxId: this.ntxId,
            mainNtxId: this.mainNtxId,
            notePath: this.notePath,
            hoistedNoteId: this.hoistedNoteId,
            active: this.isActive(),
            viewScope: this.viewScope
        }
    }

    async unhoist() {
        await this.setHoistedNoteId('root');
    }

    async setHoistedNoteId(noteIdToHoist) {
        if (this.hoistedNoteId === noteIdToHoist) {
            return;
        }

        this.hoistedNoteId = noteIdToHoist;

        if (!this.notePathArray?.includes(noteIdToHoist) && !utils.isMobile()) {
            await this.setNote(noteIdToHoist);
        }

        await this.triggerEvent('hoistedNoteChanged', {
            noteId: noteIdToHoist,
            ntxId: this.ntxId
        });
    }

    /** @returns {Promise<boolean>} */
    async isReadOnly() {
        if (this.viewScope.readOnlyTemporarilyDisabled) {
            return false;
        }

        // "readOnly" is a state valid only for text/code notes
        if (!this.note || (this.note.type !== 'text' && this.note.type !== 'code')) {
            return false;
        }

        if (this.note.isLabelTruthy('readOnly')) {
            return true;
        }

        if (this.viewScope.viewMode === 'source') {
            return true;
        }

        const blob = await this.note.getBlob();

        const sizeLimit = this.note.type === 'text'
            ? options.getInt('autoReadonlySizeText')
            : options.getInt('autoReadonlySizeCode');

        return blob.contentLength > sizeLimit
            && !this.note.isLabelTruthy('autoReadOnlyDisabled');
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteReloaded(this.noteId)) {
            const noteRow = loadResults.getEntityRow('notes', this.noteId);

            if (noteRow.isDeleted) {
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
            && this.viewScope.viewMode === 'default'
            && this.note.hasChildren()
            && ['book', 'text', 'code'].includes(this.note.type)
            && this.note.mime !== 'text/x-sqlite;schema=trilium'
            && !this.note.isLabelTruthy('hideChildrenOverview');
    }

    async getTextEditor(callback) {
        return this.timeout(new Promise(resolve => appContext.triggerCommand('executeWithTextEditor', {
            callback,
            resolve,
            ntxId: this.ntxId
        })));
    }

    async getCodeEditor() {
        return this.timeout(new Promise(resolve => appContext.triggerCommand('executeWithCodeEditor', {
            resolve,
            ntxId: this.ntxId
        })));
    }

    async getContentElement() {
        return this.timeout(new Promise(resolve => appContext.triggerCommand('executeWithContentElement', {
            resolve,
            ntxId: this.ntxId
        })));
    }

    async getTypeWidget() {
        return this.timeout(new Promise(resolve => appContext.triggerCommand('executeWithTypeWidget', {
            resolve,
            ntxId: this.ntxId
        })));
    }

    timeout(promise) {
        return Promise.race([
            promise,
            new Promise(res => setTimeout(() => res(null), 200))
        ]);
    }

    resetViewScope() {
        // view scope contains data specific to one note context and one "view".
        // it is used to e.g., make read-only note temporarily editable or to hide TOC
        // this is reset after navigating to a different note
        this.viewScope = {};
    }

    async getNavigationTitle() {
        if (!this.note) {
            return null;
        }

        const { note, viewScope } = this;

        let title = viewScope.viewMode === 'default'
            ? note.title
            : `${note.title}: ${viewScope.viewMode}`;

        if (viewScope.attachmentId) {
            // assuming the attachment has been already loaded
            const attachment = await note.getAttachmentById(viewScope.attachmentId);

            if (attachment) {
                title += `: ${attachment.title}`;
            }
        }

        return title;
    }
}

export default NoteContext;
