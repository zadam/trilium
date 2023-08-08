/**
 * Mac specific initialization
 */
import utils from "./utils.js";
import shortcutService from "./shortcuts.js";

function init() {
    if (utils.isElectron() && utils.isMac()) {
        shortcutService.bindGlobalShortcut('meta+c', () => exec("copy"));
        shortcutService.bindGlobalShortcut('meta+v', () => exec('paste'));
        shortcutService.bindGlobalShortcut('meta+x', () => exec('cut'));
        shortcutService.bindGlobalShortcut('meta+a', () => exec('selectAll'));
        shortcutService.bindGlobalShortcut('meta+z', () => exec('undo'));
        shortcutService.bindGlobalShortcut('meta+y', () => exec('redo'));
    }
}

function exec(cmd) {
    document.execCommand(cmd);

    return false;
}

export default {
    init
}
