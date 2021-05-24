import ButtonWidget from "./button_widget.js";

export default class CreatePaneButton extends ButtonWidget {
    constructor() {
        super();

        this.icon("bx-window-open bx-rotate-90")
            .title("Create new pane")
            .titlePlacement("bottom")
            .onClick(widget => widget.triggerCommand("openNewPane", { ntxId: widget.getNtxId() }));
    }
}
