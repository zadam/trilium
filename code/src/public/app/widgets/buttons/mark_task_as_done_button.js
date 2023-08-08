import CommandButtonWidget from "./command_button.js";

export default class MarkTaskAsDoneButton extends CommandButtonWidget {
    constructor() {
        super();
        this.icon('bx-check-square')
            .title("Mark As Done")
            .command("markAsDone")
            .titlePlacement("bottom")
            .class("icon-action");
    }

    isEnabled() {
        return super.isEnabled() && this.note?.type === 'task';
    }
}