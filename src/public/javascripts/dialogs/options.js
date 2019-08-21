"use strict";

import server from '../services/server.js';
import utils from "../services/utils.js";

const $dialog = $("#options-dialog");

export async function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    const options = await server.get('options');

    $dialog.modal();

    (await Promise.all([
        import('./options/advanced.js'),
        import('./options/appearance.js'),
        import('./options/change_password.js'),
        import('./options/note_revisions.js'),
        import('./options/protected_session.js'),
        import('./options/sidebar.js'),
        import('./options/sync.js'),
    ]))
        .map(m => new m.default)
        .forEach(tab => {
            if (tab.optionsLoaded) {
                tab.optionsLoaded(options)
            }
        });
}