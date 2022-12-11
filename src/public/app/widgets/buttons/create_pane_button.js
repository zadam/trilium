import OnClickButtonWidget from "./onclick_button.js";

export default class CreatePaneButton extends OnClickButtonWidget {
    constructor() {
        super();

        this.icon("bx-dock-right")
            .title("Create new split")
            .titlePlacement("bottom")
            .onClick(widget => widget.triggerCommand("openNewNoteSplit", { ntxId: widget.getClosestNtxId() }))
            .class("icon-action");
    }
}
