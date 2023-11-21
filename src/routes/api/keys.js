"use strict";

import keyboardActions from '../../services/keyboard_actions.js'
import becca from '../../becca/becca.js'

function getKeyboardActions() {
    return keyboardActions.getKeyboardActions();
}

function getShortcutsForNotes() {
    const labels = becca.findAttributes('label', 'keyboardShortcut');

    // launchers have different handling
    return labels.filter(attr => becca.getNote(attr.noteId)?.type !== 'launcher');
}

export default {
    getKeyboardActions,
    getShortcutsForNotes
};
