import FlexContainer from "./flex_container.js";
import utils from "../../services/utils.js";
import appContext from "../../services/app_context.js";

export default class RootContainer extends FlexContainer {
    constructor() {
        super('row');

        this.id('root-widget');
        this.css('height', '100%');
    }

    refresh() {
        this.$widget.removeClass(); // remove all classes
        const note = appContext.tabManager.getActiveContextNote();

        if (note) {
            this.$widget.addClass(note.getCssClass());

            this.$widget.addClass(utils.getNoteTypeClass(note.type));
            this.$widget.addClass(utils.getMimeTypeClass(note.mime));

            this.$widget.toggleClass("protected", note.isProtected);
        }
    }

    noteSwitchedEvent() {
        this.refresh();
    }

    activeContextChangedEvent() {
        this.refresh();
    }

    noteSwitchedAndActivatedEvent() {
        this.refresh();
    }

    entitiesReloadedEvent({loadResults}) {
        const note = appContext.tabManager.getActiveContextNote();
        
        if (note && loadResults.isNoteReloaded(note.noteId)) {
            this.refresh();
        }
    }
}
