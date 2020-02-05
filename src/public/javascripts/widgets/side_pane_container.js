import BasicWidget from "./basic_widget.js";
import options from "../services/options.js";

export default class SidePaneContainer extends BasicWidget {
    constructor(appContext, side, widgets) {
        super(appContext);

        this.side = side;
        this.children = widgets;
    }

    render() {
        this.$widget = $(`<div id="${this.side}-pane" style="display: flex; flex-direction: column;">`);

        for (const widget of this.children) {
            this.$widget.append(widget.render());
        }

        return this.$widget;
    }

    eventReceived(name, data, sync = false) {
        if (options.is(this.side + 'PaneVisible')) {
            super.eventReceived(name, data, sync);
        }
    }

    sidebarVisibilityChangedListener({side, show}) {
        if (this.side === side) {
            this.toggle(show);

            this.eventReceived('lazyLoaded');
        }
    }
}