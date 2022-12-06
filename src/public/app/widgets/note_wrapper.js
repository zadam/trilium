import FlexContainer from "./containers/flex_container.js";
import utils from "../services/utils.js";
import attributeService from "../services/attributes.js";

export default class NoteWrapperWidget extends FlexContainer {
    constructor() {
        super('column');

        this.css("flex-grow", "1")
            .collapsible();
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
        const isHiddenExt = this.isHiddenExt(); // preserve through class reset

        this.$widget.removeClass();

        this.toggleExt(!isHiddenExt);

        this.$widget.addClass("component note-split");

        const note = this.noteContext?.note;
        if (!note) {
            return;
        }

        this.$widget.toggleClass("full-content-width",
            ['image', 'mermaid', 'book', 'render', 'canvas', 'webView'].includes(note.type)
            || !!note?.hasLabel('fullContentWidth')
        );

        this.$widget.addClass(note.getCssClass());

        this.$widget.addClass(utils.getNoteTypeClass(note.type));
        this.$widget.addClass(utils.getMimeTypeClass(note.mime));

        this.$widget.toggleClass("protected", note.isProtected);
    }

    async entitiesReloadedEvent({loadResults}) {
        // listening on changes of note.type and CSS class

        const noteId = this.noteContext?.noteId;
        if (loadResults.isNoteReloaded(noteId)
            || loadResults.getAttributes().find(attr => attr.type === 'label' && attr.name === 'cssClass' && attributeService.isAffecting(attr, this.noteContext?.note))) {

            this.refresh();
        }
    }
}
