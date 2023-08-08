import CommandButtonWidget from "./command_button.js";

export default class CreateNewFollowUpButton extends CommandButtonWidget {
    constructor() {
        super();
        this.icon('bx-book-add')
            .title("Create Follow up")
            .command("createFollowUp")
            .titlePlacement("bottom")
            .class("icon-action");
    }

    isEnabled() {
        return super.isEnabled() && this.note?.type === 'text';
    }
}
import CommandButtonWidget from "./command_button.js";

export default class CreateNewFollowUpButton extends CommandButtonWidget {
    constructor() {
        super();
        this.icon('bx-task')
            .title("Create Follow up")
            .command("createFollowUp")
            .titlePlacement("bottom")
            .class("icon-action");
    }

    isEnabled() {
        return super.isEnabled() && this.note?.type === 'text';
    }
}