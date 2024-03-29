"use strict";

const keyboardActions = require('../../services/keyboard_actions.js');
const becca = require('../../becca/becca.js');

function getKeyboardActions() {
    return keyboardActions.getKeyboardActions();
}

function getShortcutsForNotes() {
    const labels = becca.findAttributes('label', 'keyboardShortcut');

    // launchers have different handling
    return labels.filter(attr => becca.getNote(attr.noteId)?.type !== 'launcher');
}

module.exports = {
    getKeyboardActions,
    getShortcutsForNotes
};
