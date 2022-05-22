import FlexContainer from "./containers/flex_container.js";

export default class NoteWrapperWidget extends FlexContainer {
    constructor() {
        super('column');

        this.css("flex-grow", "1")
            .collapsible();
    }

    doRender() {
        super.doRender();

        this.$widget.addClass("note-split");
    }

    setNoteContextEvent({noteContext}) {
        this.noteContext = noteContext;

        this.refresh();
    }

    noteSwitchedAndActivatedEvent() {
        this.refresh();
    }

    noteSwitchedEvent() {
        this.refresh();
    }

    activeContextChangedEvent() {
        this.refresh();
    }

    refresh() {
        const note = this.noteContext?.note;

        this.$widget.toggleClass("full-content-width",
            ['image', 'mermaid', 'book', 'render', 'canvas'].includes(note?.type)
            || !!note?.hasLabel('fullContentWidth')
        );
    }

    async entitiesReloadedEvent({loadResults}) {
        // listening on changes of note.type
        if (loadResults.isNoteReloaded(this.noteContext?.noteId)) {
            this.refresh();
        }
    }
}
