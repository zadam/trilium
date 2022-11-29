import ButtonWidget from "./button_widget.js";
import froca from "../../services/froca.js";
import attributeService from "../../services/attributes.js";

export default class ButtonFromNoteWidget extends ButtonWidget {
    constructor() {
        super();

        this.settings.buttonNoteIdProvider = null;
        this.settings.defaultIconProvider = null;
    }

    buttonNoteIdProvider(provider) {
        this.settings.buttonNoteIdProvider = provider;
        return this;
    }

    defaultIconProvider(provider) {
        this.settings.defaultIconProvider = provider;
        return this;
    }

    doRender() {
        super.doRender();

        this.updateIcon();
    }

    updateIcon() {
        const buttonNoteId = this.settings.buttonNoteIdProvider();

        if (!buttonNoteId && this.settings.defaultIconProvider()) {
            this.settings.icon = this.settings.defaultIconProvider();

            this.refreshIcon();
        } else {
            froca.getNote(buttonNoteId).then(note => {
                this.settings.icon = note.getIcon();

                this.refreshIcon();
            });
        }
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