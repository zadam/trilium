import appContext from "./app_context.js";
import shortcutService from "../services/shortcuts.js";
import server from "../services/server.js";
import Component from "./component.js";
import froca from "../services/froca.js";

export default class ShortcutComponent extends Component {
    constructor() {
        super();

        server.get('keyboard-shortcuts-for-notes').then(shortcutAttributes => {
            for (const attr of shortcutAttributes) {
                this.bindNoteShortcutHandler(attr);
            }
        });
    }

    bindNoteShortcutHandler(labelOrRow) {
        const handler = () => appContext.tabManager.getActiveContext().setNote(labelOrRow.noteId);
        const namespace = labelOrRow.attributeId;

        if (labelOrRow.isDeleted) { // only applicable if row
            shortcutService.removeGlobalShortcut(namespace);
        } else {
            shortcutService.bindGlobalShortcut(labelOrRow.value, handler, namespace);
        }
    }

    async entitiesReloadedEvent({loadResults}) {
        for (const attr of loadResults.getAttributeRows()) {
            if (attr.type === 'label' && attr.name === 'keyboardShortcut') {
                const note = await froca.getNote(attr.noteId);
                // launcher shortcuts are handled specifically
                if (note && note.type !== 'launcher') {
                    this.bindNoteShortcutHandler(attr);
                }
            }
        }
    }
}
