import ButtonWidget from "./button_widget.js";
import appContext from "../../services/app_context.js";

export default class EditButton extends ButtonWidget {
    isEnabled() {
        return super.isEnabled() && this.noteContext;
    }

    constructor() {
        super();

        this.icon("bx-edit-alt")
            .title("Edit this note")
            .titlePlacement("bottom")
            .onClick(widget => {
                this.noteContext.readOnlyTemporarilyDisabled = true;

                appContext.triggerEvent('readOnlyTemporarilyDisabled', {noteContext: this.noteContext});

                this.refresh();
            });
    }

    async refreshWithNote(note) {
        // can't do this in isEnabled() since isReadOnly is async
        this.toggleInt(await this.noteContext.isReadOnly());

        await super.refreshWithNote(note);
    }
}
