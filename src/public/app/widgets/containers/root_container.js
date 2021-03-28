import FlexContainer from "./flex_container.js";
import utils from "../../services/utils.js";
import appContext from "../../services/app_context.js";

export default class RootContainer extends FlexContainer {
    constructor() {
        super('column');

        this.id('root-widget');
        this.css('height', '100vh');
    }

    refresh() {
        this.$widget.removeClass(); // remove all classes
        const note = appContext.tabManager.getActiveTabNote();

        if (note) {
            this.$widget.addClass(note.getCssClass());

            this.$widget.addClass(utils.getNoteTypeClass(note.type));
            this.$widget.addClass(utils.getMimeTypeClass(note.mime));

            this.$widget.toggleClass("protected", note.isProtected);
        }
    }

    tabNoteSwitchedEvent() {
        this.refresh();
    }

    activeTabChangedEvent() {
        this.refresh();
    }

    tabNoteSwitchedAndActivatedEvent() {
        this.refresh();
    }

    noteTypeMimeChangedEvent() {
        this.refresh();
    }
}
