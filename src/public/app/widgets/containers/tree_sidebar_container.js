import options from "../../services/options.js";
import FlexContainer from "./flex_container.js";

export default class TreeSidebarContainer extends FlexContainer {
    constructor() {
        super('column');

        this.id('tree-sidebar');
        this.css('height', '100%');
    }

    isEnabled() {
        return super.isEnabled() && options.is( 'leftPaneVisible');
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isOptionReloaded("leftPaneVisible")) {
            this.toggleInt(this.isEnabled());
        }
    }
}
