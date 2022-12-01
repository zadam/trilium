import ButtonWidget from "./button_widget.js";

export default class NoteRevisionsButton extends ButtonWidget {
    constructor() {
        super();

        this.icon('bx-history')
            .title("Note Revisions")
            .command("showNoteRevisions")
            .titlePlacement("bottom");
    }

    isEnabled() {
        return super.isEnabled() && !['launcher', 'doc'].includes(this.note?.type);
    }
}
