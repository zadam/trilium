import froca from "../../services/froca.js";
import attributeService from "../../services/attributes.js";
import CommandButtonWidget from "./command_button.js";

export default class ButtonFromNoteWidget extends CommandButtonWidget {
    constructor() {
        super();

        this.settings.buttonNoteIdProvider = null;
    }

    buttonNoteIdProvider(provider) {
        this.settings.buttonNoteIdProvider = provider;
        return this;
    }

    doRender() {
        super.doRender();

        this.updateIcon();
    }

    updateIcon() {
        const buttonNoteId = this.settings.buttonNoteIdProvider();

        if (!buttonNoteId) {
            console.error(`buttonNoteId for '${this.componentId}' is not defined.`);
            return;
        }

        froca.getNote(buttonNoteId).then(note => {
            this.settings.icon = note.getIcon();

            this.refreshIcon();
        });
    }

    entitiesReloadedEvent({loadResults}) {
        const buttonNote = froca.getNoteFromCache(this.buttonNoteIdProvider());

        if (!buttonNote) {
            return;
        }

        if (loadResults.getAttributes(this.componentId).find(attr =>
            attr.type === 'label'
            && attr.name === 'iconClass'
            && attributeService.isAffecting(attr, buttonNote))) {

            this.updateIcon();
        }
    }
}