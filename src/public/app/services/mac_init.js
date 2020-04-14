/**
 * Mac specific initialization
 */
import utils from "./utils.js";

function init() {
    if (utils.isElectron() && utils.isMac()) {
        utils.bindGlobalShortcut('meta+c', () => exec("copy"));
        utils.bindGlobalShortcut('meta+v', () => exec('paste'));
        utils.bindGlobalShortcut('meta+x', () => exec('cut'));
        utils.bindGlobalShortcut('meta+a', () => exec('selectAll'));
        utils.bindGlobalShortcut('meta+z', () => exec('undo'));
        utils.bindGlobalShortcut('meta+y', () => exec('redo'));
    }
}

function exec(cmd) {
    document.execCommand(cmd);

    return false;
}

export default {
    init
}