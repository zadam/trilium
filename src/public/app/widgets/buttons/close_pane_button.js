import OnClickButtonWidget from "./onclick_button.js";

export default class ClosePaneButton extends OnClickButtonWidget {
    isEnabled() {
        return super.isEnabled()
            // main note context should not be closeable
            && this.noteContext && !!this.noteContext.mainNtxId;
    }

    constructor() {
        super();

        this.icon("bx-x")
            .title("Close this pane")
            .titlePlacement("bottom")
            .onClick((widget, e) => {
                // to avoid split pane container detecting click within the pane which would try to activate this
                // pane (which is being removed)
                e.stopPropagation();

                widget.triggerCommand("closeThisNoteSplit", { ntxId: widget.getClosestNtxId() });
            })
            .class("icon-action");
    }
}
