/**
 * Mac specific initialization
 */
import utils from "./utils.js";

function init() {
    if (utils.isElectron() && utils.isMac()) {
        utils.bindShortcut('meta+c', () => exec("copy"));
        utils.bindShortcut('meta+v', () => exec('paste'));
        utils.bindShortcut('meta+x', () => exec('cut'));
        utils.bindShortcut('meta+a', () => exec('selectAll'));
        utils.bindShortcut('meta+z', () => exec('undo'));
        utils.bindShortcut('meta+y', () => exec('redo'));
    }
}

function exec(cmd) {
    document.execCommand(cmd);

    return false;
}

export default {
    init
}