import ButtonWidget from "./button_widget.js";

export default class CreatePaneButton extends ButtonWidget {
    constructor() {
        super();

        this.icon("bx-dock-right")
            .title("Create new pane")
            .titlePlacement("bottom")
            .onClick(widget => widget.triggerCommand("openNewPane", { ntxId: widget.getNtxId() }));
    }
}
