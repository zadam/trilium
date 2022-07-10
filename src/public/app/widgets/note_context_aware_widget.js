import BasicWidget from "./basic_widget.js";
import appContext from "../services/app_context.js";

export default class NoteContextAwareWidget extends BasicWidget {
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

    get note() {
        return this.noteContext?.note;
    }

    get noteId() {
        return this.note?.noteId;
    }

    get notePath() {
        return this.noteContext?.notePath;
    }

    get hoistedNoteId() {
        return this.noteContext?.hoistedNoteId;
    }

    get ntxId() {
        return this.noteContext?.ntxId;
    }

    isEnabled() {
        return !!this.note;
    }

    async refresh() {
        if (this.isEnabled()) {
            const start = Date.now();

            this.toggleInt(true);
            await this.refreshWithNote(this.note);

            const end = Date.now();

            if (glob.PROFILING_LOG && end - start > 10) {
                console.log(`Refresh of ${this.componentId} took ${end-start}ms`);
            }
        }
        else {
            this.toggleInt(false);
        }
    }

    async refreshWithNote(note) {}

    async noteSwitchedEvent({noteContext, notePath}) {
        // if notePath does not match then the noteContext has been switched to another note in the meantime
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

    // when note is both switched and activated, this should not produce double refresh
    async noteSwitchedAndActivatedEvent({noteContext, notePath}) {
        this.noteContext = noteContext;

        // if notePath does not match then the noteContext has been switched to another note in the meantime
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
