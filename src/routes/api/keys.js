"use strict";

const keyboardActions = require('../../services/keyboard_actions');
const sql = require('../../services/sql');

function getKeyboardActions() {
    return keyboardActions.getKeyboardActions();
}

function getShortcutsForNotes() {
    return sql.getMap(`
        SELECT value, noteId
        FROM attributes
        WHERE isDeleted = 0
          AND type = 'label'
          AND name = 'keyboardShortcut'`);
}

module.exports = {
    getKeyboardActions,
    getShortcutsForNotes
};
