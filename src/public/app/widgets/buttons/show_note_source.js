import ButtonWidget from "./button_widget.js";

export default class ShowNoteSourceButton extends ButtonWidget {
    isEnabled() {
        return super.isEnabled() && this.note && ['text', 'relation-map'].includes(this.note.type);
    }

    constructor() {
        super();

        this.icon('bx bx-code')
            .title("Show Note Source")
            .command("openNoteSourceDialog")
            .titlePlacement("bottom");
    }
}
