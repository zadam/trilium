import utils from "./utils.js";

function removeGlobalShortcut(namespace) {
    bindGlobalShortcut('', null, namespace);
}

function bindGlobalShortcut(keyboardShortcut, handler, namespace = null) {
    bindElShortcut($(document), keyboardShortcut, handler, namespace);
}

function bindElShortcut($el, keyboardShortcut, handler, namespace = null) {
    if (utils.isDesktop()) {
        keyboardShortcut = normalizeShortcut(keyboardShortcut);

        let eventName = 'keydown';

        if (namespace) {
            eventName += `.${namespace}`;

            // if there's a namespace then we replace the existing event handler with the new one
            $el.off(eventName);
        }

        // method can be called to remove the shortcut (e.g. when keyboardShortcut label is deleted)
        if (keyboardShortcut) {
            $el.bind(eventName, keyboardShortcut, e => {
                handler(e);

                e.preventDefault();
                e.stopPropagation();
            });
        }
    }
}

/**
 * Normalize to the form expected by the jquery.hotkeys.js
 */
function normalizeShortcut(shortcut) {
    if (!shortcut) {
        return shortcut;
    }

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
    removeGlobalShortcut,
    normalizeShortcut
}
