import GlobalButtonsWidget from "../widgets/global_buttons.js";
import SearchBoxWidget from "../widgets/search_box.js";
import SearchResultsWidget from "../widgets/search_results.js";
import NoteTreeWidget from "../widgets/note_tree.js";

export default class AppContext {
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

        this.widgets = [
            new GlobalButtonsWidget(this),
            new SearchBoxWidget(this),
            new SearchResultsWidget(this),
            new NoteTreeWidget(this)
        ];

        for (const widget of this.widgets) {
            const $widget = widget.render();

            $leftPane.append($widget);
        }
    }
}