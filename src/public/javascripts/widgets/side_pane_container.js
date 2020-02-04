import BasicWidget from "./basic_widget.js";
import optionService from "../services/options.js";

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

    async eventReceived(name, data, sync = false) {
        const options = await optionService.waitForOptions();

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