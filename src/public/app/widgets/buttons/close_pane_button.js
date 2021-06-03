import ButtonWidget from "./button_widget.js";

export default class ClosePaneButton extends ButtonWidget {
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
            .onClick(widget => widget.triggerCommand("closeThisNoteSplit", { ntxId: widget.getNtxId() }));
    }
}
