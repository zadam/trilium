import CommandButtonWidget from "./command_button.js";

export default class RevisionsButton extends CommandButtonWidget {
    constructor() {
        super();

        this.icon('bx-history')
            .title("Note Revisions")
            .command("showRevisions")
            .titlePlacement("bottom")
            .class("icon-action");
    }

    isEnabled() {
        return super.isEnabled() && !['launcher', 'doc'].includes(this.note?.type);
    }
}
