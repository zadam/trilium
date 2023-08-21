import BasicWidget from "./basic_widget.js";
import appContext from "../components/app_context.js";

/**
 * This widget allows for changing and updating depending on the active note.
 * @extends {BasicWidget}
 */
class NoteContextAwareWidget extends BasicWidget {
    isNoteContext(ntxId) {
        if (Array.isArray(ntxId)) {
            return this.noteContext && ntxId.includes(this.noteContext.ntxId);
        }
        else {
            return this.noteContext && this.noteContext.ntxId === ntxId;
        }
    }

    isActiveNoteContext() {
        return appContext.tabManager.getActiveContext() === this.noteContext;
    }

    isNote(noteId) {
        return this.noteId === noteId;
    }

    /** @returns {FNote|undefined} */
    get note() {
        return this.noteContext?.note;
    }

    /** @returns {string|undefined} */
    get noteId() {
        return this.note?.noteId;
    }

    /** @returns {string|undefined} */
    get notePath() {
        return this.noteContext?.notePath;
    }

    /** @returns {string} */
    get hoistedNoteId() {
        return this.noteContext?.hoistedNoteId;
    }

    get ntxId() {
        return this.noteContext?.ntxId;
    }

    /**
     * @returns {boolean} true when an active note exists
     */
    isEnabled() {
        return !!this.note;
    }

    async refresh() {
        if (this.isEnabled()) {
            this.toggleInt(true);
            await this.refreshWithNote(this.note);
        }
        else {
            this.toggleInt(false);
        }
    }

    /**
     * Override this method to be able to refresh your
     * widget with each note.
     * @param {FNote} note
     * @returns {Promise<void>}
     */
    async refreshWithNote(note) {}

    async noteSwitchedEvent({noteContext, notePath}) {
        // if notePath does not match, then the noteContext has been switched to another note in the meantime
        if (noteContext.notePath === notePath) {
            await this.noteSwitched();
        }
    }

    async noteSwitched() {
        await this.refresh();
    }

    async activeContextChangedEvent({noteContext}) {
        this.noteContext = noteContext;

        await this.activeContextChanged();
    }

    async activeContextChanged() {
        await this.refresh();
    }

    // when note is both switched and activated, this should not produce a double refresh
    async noteSwitchedAndActivatedEvent({noteContext, notePath}) {
        this.noteContext = noteContext;

        // if notePath does not match, then the noteContext has been switched to another note in the meantime
        if (this.notePath === notePath) {
            await this.refresh();
        }
    }

    setNoteContextEvent({noteContext}) {
        /** @var {NoteContext} */
        this.noteContext = noteContext;
    }

    async noteTypeMimeChangedEvent({noteId}) {
        if (this.isNote(noteId)) {
            await this.refresh();
        }
    }

    async frocaReloadedEvent() {
        await this.refresh();
    }
}

export default NoteContextAwareWidget;
