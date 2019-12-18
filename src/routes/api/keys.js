"use strict";

const keyboardActions = require('../../services/keyboard_actions');
const sql = require('../../services/sql');

async function getKeyboardActions() {
    return await keyboardActions.getKeyboardActions();
}

async function getShortcutsForNotes() {
    return await sql.getMap(`
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