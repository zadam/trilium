"use strict";

const keyboardActions = require('../../services/keyboard_actions');

async function getKeyboardActions() {
    return await keyboardActions.getKeyboardActions();
}

module.exports = {
    getKeyboardActions
};