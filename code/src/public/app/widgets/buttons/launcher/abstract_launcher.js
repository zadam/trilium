import shortcutService from "../../../services/shortcuts.js";
import attributesService from "../../../services/attributes.js";
import OnClickButtonWidget from "../onclick_button.js";

export default class AbstractLauncher extends OnClickButtonWidget {
    constructor(launcherNote) {
        super();

        this.class("launcher-button");

        /** @type {FNote} */
        this.launcherNote = launcherNote;

        for (const label of launcherNote.getOwnedLabels('keyboardShortcut')) {
            this.bindNoteShortcutHandler(label);
        }
    }

    launch() {
        throw new Error("Abstract implementation");
    }

    bindNoteShortcutHandler(labelOrRow) {
        const namespace = labelOrRow.attributeId;

        if (labelOrRow.isDeleted) { // only applicable if row
            shortcutService.removeGlobalShortcut(namespace);
        } else {
            shortcutService.bindGlobalShortcut(labelOrRow.value, () => this.launch(), namespace);
        }
    }

    entitiesReloadedEvent({loadResults}) {
        for (const attr of loadResults.getAttributeRows()) {
            if (attr.noteId === this.launcherNote.noteId && attr.type === 'label' && attr.name === 'keyboardShortcut') {
                this.bindNoteShortcutHandler(attr);
            } else if (attr.type === 'label' && attr.name === 'iconClass' && attributesService.isAffecting(attr, this.launcherNote)) {
                this.refreshIcon();
            }
        }
    }
}
