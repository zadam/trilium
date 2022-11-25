import AbstractHistoryNavigationWidget from "./abstract_history.js";

export default class BackInHistoryButtonWidget extends AbstractHistoryNavigationWidget {
    constructor() {
        super();

        this.icon('bx-left-arrow-circle')
            .title("Go to previous note.")
            .command("backInNoteHistory")
            .titlePlacement("right")
            .buttonNoteId('lb_backinhistory')
            .onContextMenu(e => this.showContextMenu(e));
    }
}
