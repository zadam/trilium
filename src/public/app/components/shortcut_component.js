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

    bindNoteShortcutHandler(attr) {
        const handler = () => appContext.tabManager.getActiveContext().setNote(attr.noteId);
        const namespace = attr.attributeId;

        if (attr.isDeleted) {
            shortcutService.removeGlobalShortcut(namespace);
        } else {
            shortcutService.bindGlobalShortcut(attr.value, handler, namespace);
        }
    }

    async entitiesReloadedEvent({loadResults}) {
        for (const attr of loadResults.getAttributes()) {
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
