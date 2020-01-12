import GlobalButtonsWidget from "../widgets/global_buttons.js";
import SearchBoxWidget from "../widgets/search_box.js";
import SearchResultsWidget from "../widgets/search_results.js";
import NoteTreeWidget from "../widgets/note_tree.js";

class AppContext {
    constructor() {
        this.widgets = [];
    }

    trigger(name, data) {
        for (const widget of this.widgets) {
            widget.eventReceived(name, data);
        }
    }

    showWidgets() {
        const $leftPane = $("#left-pane");

        this.noteTreeWidget = new NoteTreeWidget(this);

        this.widgets = [
            new GlobalButtonsWidget(this),
            new SearchBoxWidget(this),
            new SearchResultsWidget(this),
            this.noteTreeWidget
        ];

        for (const widget of this.widgets) {
            const $widget = widget.render();

            $leftPane.append($widget);
        }
    }

    /**
     * @return {NoteTreeWidget}
     */
    getMainNoteTree() {
        return this.noteTreeWidget;
    }
}

const appContext = new AppContext();

export default appContext;