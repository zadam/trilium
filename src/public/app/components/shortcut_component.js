import appContext from "./app_context.js";
import shortcutService from "../services/shortcuts.js";
import server from "../services/server.js";
import Component from "./component.js";

export default class ShortcutComponent extends Component {
    constructor() {
        server.get('keyboard-shortcuts-for-notes').then(shortcutAttributes => {
            for (const attr in shortcutAttributes) {
                bindNoteShortcutHandler(attr);
            }
    }

    bindNoteShortcutHandler(attr) {
        const handler = async () => appContext.tabManager.getActiveContext().setNote(attr.noteId);

        shortcutService.bindGlobalShortcut(attr.value, handler, attr.attributeId);
    }
}
