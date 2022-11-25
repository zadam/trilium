import ButtonWidget from "./button_widget.js";
import froca from "../../services/froca.js";
import attributeService from "../../services/attributes.js";

export default class ButtonFromNoteWidget extends ButtonWidget {
    constructor() {
        super();

        this.settings.buttonNoteId = null;
    }

    buttonNoteId(noteId) {
        this.settings.buttonNoteId = noteId;
        return this;
    }

    doRender() {
        super.doRender();

        this.updateIcon();
    }

    updateIcon() {
        froca.getNote(this.settings.buttonNoteId).then(note => {
            this.settings.icon = note.getLabelValue("iconClass");

            this.refreshIcon();
        });
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.getAttributes(this.componentId).find(attr =>
            attr.type === 'label'
            && attr.name === 'iconClass'
            && attributeService.isAffecting(attr, this.note))) {

            this.updateIcon();
        }
    }
}