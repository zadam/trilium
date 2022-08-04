import options from "../../services/options.js";
import FlexContainer from "./flex_container.js";

export default class LeftPaneContainer extends FlexContainer {
    constructor() {
        super('column');

        this.id('left-pane');
        this.css('height', '100%');
        this.collapsible();
    }

    isEnabled() {
        return super.isEnabled() && options.is('leftPaneVisible');
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isOptionReloaded("leftPaneVisible")) {
            this.toggleInt(this.isEnabled());
        }
    }
}
