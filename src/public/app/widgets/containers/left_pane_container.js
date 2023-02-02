import options from "../../services/options.js";
import FlexContainer from "./flex_container.js";
import appContext from "../../components/app_context.js";

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
            const visible = this.isEnabled();
            this.toggleInt(visible);

            if (visible) {
                this.triggerEvent('focusTree');
            } else {
                const activeNoteContext = appContext.tabManager.getActiveContext();
                this.triggerEvent('focusOnDetail', {ntxId: activeNoteContext.ntxId});
            }
        }
    }
}
