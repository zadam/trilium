import options from "../services/options.js";
import FlexContainer from "./flex_container.js";

export default class SidePaneContainer extends FlexContainer {
    constructor(appContext, side, widgets) {
        super(appContext, {id: side + '-pane', 'flex-direction': 'column', 'height': '100%'}, widgets);

        this.side = side;
        this.children = widgets;
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