import utils from "./utils.js";

function bindGlobalShortcut(keyboardShortcut, handler) {
    bindElShortcut($(document), keyboardShortcut, handler);
}

function bindElShortcut($el, keyboardShortcut, handler) {
    if (utils.isDesktop()) {
        keyboardShortcut = normalizeShortcut(keyboardShortcut);

        $el.bind('keydown', keyboardShortcut, e => {
            handler(e);

            e.preventDefault();
            e.stopPropagation();
        });
    }
}

/**
 * Normalize to the form expected by the jquery.hotkeys.js
 */
function normalizeShortcut(shortcut) {
    return shortcut
        .toLowerCase()
        .replace("enter", "return")
        .replace("delete", "del")
        .replace("ctrl+alt", "alt+ctrl")
        .replace("meta+alt", "alt+meta"); // alt needs to be first;
}

export default {
    bindGlobalShortcut,
    bindElShortcut,
    normalizeShortcut
}
