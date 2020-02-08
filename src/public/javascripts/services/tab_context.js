import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import bundleService from "./bundle.js";
import utils from "./utils.js";
import optionsService from "./options.js";
import appContext from "./app_context.js";
import treeService from "./tree.js";
import Component from "../widgets/component.js";
import treeCache from "./tree_cache.js";
import hoistedNoteService from "./hoisted_note.js";

class TabContext extends Component {
    /**
     * @param {AppContext} appContext
     * @param {object} state
     */
    constructor(appContext, state = {}) {
        super(appContext);

        this.tabId = state.tabId || utils.randomString(4);
        this.state = state;

        this.trigger('tabOpened', {tabId: this.tabId});
    }

    async setNote(inputNotePath) {
        const notePath = await treeService.resolveNotePath(inputNotePath);

        if (!notePath) {
            console.error(`Cannot resolve note path ${inputNotePath}`);
            return;
        }

        if (notePath === this.notePath) {
            return;
        }

        if (await hoistedNoteService.checkNoteAccess(notePath) === false) {
            return; // note is outside of hoisted subtree and user chose not to unhoist
        }

        await this.trigger('beforeNoteSwitch', {tabId: this.tabId}, true);

        utils.closeActiveDialog();

        this.notePath = notePath;
        this.noteId = treeService.getNoteIdFromNotePath(notePath);

        this.autoBookDisabled = false;

        //this.cleanup(); // esp. on windows autocomplete is not getting closed automatically

        setTimeout(async () => {
            // we include the note into recent list only if the user stayed on the note at least 5 seconds
            if (notePath && notePath === this.notePath) {
                await server.post('recent-notes', {
                    noteId: this.note.noteId,
                    notePath: this.notePath
                });
            }
        }, 5000);

        if (this.note.isProtected && protectedSessionHolder.isProtectedSessionAvailable()) {
            // FIXME: there are probably more places where this should be done
            protectedSessionHolder.touchProtectedSession();
        }

        this.trigger('tabNoteSwitched', {
            tabId: this.tabId,
            notePath: this.notePath
        });

        this.trigger('openTabsChanged');
    }

    /** @property {NoteShort} */
    get note() {
        return treeCache.notes[this.noteId];
    }

    /** @return {NoteComplement} */
    async getNoteComplement() {
        if (!this.noteId) {
            return null;
        }

        return await treeCache.getNoteComplement(this.noteId);
    }

    isActive() {
        return this.tabManager.activeTabId === this.tabId;
    }

    getTabState() {
        if (!this.notePath) {
            return null;
        }

        return {
            tabId: this.tabId,
            notePath: this.notePath,
            active: this.tabManager.activeTabId === this.tabId
        }
    }

    stateChanged() {
        appContext.openTabsChangedListener();
    }

    noteDeletedListener({noteId}) {
        if (this.noteId === noteId) {
            this.noteId = null;
            this.notePath = null;

            this.trigger('tabNoteSwitched', {
                tabId: this.tabId,
                notePath: this.notePath
            });
        }
    }

    // FIXME
    async _setTitleBar() {
        document.title = "Trilium Notes";

        const activeTabContext = this.getActiveTabContext();

        if (activeTabContext && activeTabContext.notePath) {
            const note = await treeCache.getNote(treeService.getNoteIdFromNotePath(activeTabContext.notePath));

            // it helps navigating in history if note title is included in the title
            document.title += " - " + note.title;
        }
    }
}

export default TabContext;