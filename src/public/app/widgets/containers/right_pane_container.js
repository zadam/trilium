import FlexContainer from "./flex_container.js";
import splitService from "../../services/resizer.js";

export default class RightPaneContainer extends FlexContainer {
    constructor() {
        super('column');

        this.id('right-pane');
        this.css('height', '100%');
        this.collapsible();
    }

    isEnabled() {
        return super.isEnabled()
            && this.children.length > 0
            && !!this.children.find(ch => ch.isEnabled() && ch.canBeShown());
    }

    handleEventInChildren(name, data) {
        const promise = super.handleEventInChildren(name, data);

        if (['activeContextChanged', 'noteSwitchedAndActivated', 'noteSwitched'].includes(name)) {
            // right pane is displayed only if some child widget is active
            // we'll reevaluate the visibility based on events which are probable to cause visibility change
            // but these events needs to be finished and only then we check
            if (promise) {
                promise.then(() => this.reEvaluateRightPaneVisibilityCommand());
            }
            else {
                this.reEvaluateRightPaneVisibilityCommand();
            }
        }

        return promise;
    }

    reEvaluateRightPaneVisibilityCommand() {
        const oldToggle = !this.isHiddenInt();
        const newToggle = this.isEnabled();

        if (oldToggle !== newToggle) {
            this.toggleInt(newToggle);

            splitService.setupRightPaneResizer();
        }
    }
}
