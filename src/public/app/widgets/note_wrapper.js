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
        this.refresh(noteContext);
    }

    noteSwitchedAndActivatedEvent({noteContext}) {
        this.refresh(noteContext);
    }

    noteSwitchedEvent({noteContext}) {
        this.refresh(noteContext);
    }

    activeContextChangedEvent({noteContext}) {
        this.refresh(noteContext);
    }

    refresh(noteContext) {
        this.$widget.toggleClass("full-content-width",
            ['image', 'mermaid', 'book', 'render'].includes(noteContext?.note?.type)
            || !!noteContext?.note?.hasLabel('fullContentWidth')
        );
    }
}
