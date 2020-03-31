import options from "../services/options.js";
import FlexContainer from "./flex_container.js";

export default class SidePaneContainer extends FlexContainer {
    constructor(side) {
        super('column');

        this.side = side;

        this.id(side + '-pane');
        this.css('height', '100%');
    }

    isEnabled() {
        return super.isEnabled() && options.is(this.side + 'PaneVisible');
    }

    sidebarVisibilityChangedEvent({side, show}) {
        this.toggleInt(this.isEnabled());

        if (this.side === side && show) {
            this.handleEvent('lazyLoaded');
        }
    }
}