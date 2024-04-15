"use strict";

import keyboardActions = require('../../services/keyboard_actions');
import becca = require('../../becca/becca');

function getKeyboardActions() {
    return keyboardActions.getKeyboardActions();
}

function getShortcutsForNotes() {
    const labels = becca.findAttributes('label', 'keyboardShortcut');

    // launchers have different handling
    return labels.filter(attr => becca.getNote(attr.noteId)?.type !== 'launcher');
}

export = {
    getKeyboardActions,
    getShortcutsForNotes
};
