import AbstractHistoryNavigationWidget from "./abstract_history.js";

export default class ForwardInHistoryButtonWidget extends AbstractHistoryNavigationWidget {
    constructor() {
        super();

        this.icon('bx-left-arrow-circle')
            .title("Go to next note.")
            .command("forwardInNoteHistory")
            .titlePlacement("right")
            .buttonNoteIdProvider(() => 'lbForwardInHistory')
            .onContextMenu(e => this.showContextMenu(e));
    }
}
