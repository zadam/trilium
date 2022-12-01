"use strict";

const keyboardActions = require('../../services/keyboard_actions');
const becca = require('../../becca/becca');

function getKeyboardActions() {
    return keyboardActions.getKeyboardActions();
}

function getShortcutsForNotes() {
    const attrs = becca.findAttributes('label', 'keyboardShortcut');

    const map = {};

    for (const attr of attrs) {
        const note = becca.getNote(attr.noteId);

        if (note?.type === 'launcher') {
            // launchers have different handling
            continue;
        }

        map[attr.value] = attr.noteId;
    }

    return map;
}

module.exports = {
    getKeyboardActions,
    getShortcutsForNotes
};
