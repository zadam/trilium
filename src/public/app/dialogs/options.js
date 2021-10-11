"use strict";

import server from '../services/server.js';
import utils from "../services/utils.js";

const $dialog = $("#options-dialog");

export async function showDialog() {
    const options = await server.get('options');

    utils.openDialog($dialog);

    (await Promise.all([
        import('./options/appearance.js'),
        import('./options/shortcuts.js'),
        import('./options/code_notes.js'),
        import('./options/credentials.js'),
        import('./options/backup.js'),
        import('./options/sync.js'),
        import('./options/other.js'),
        import('./options/advanced.js')
    ]))
        .map(m => new m.default)
        .forEach(tab => {
            if (tab.optionsLoaded) {
                tab.optionsLoaded(options)
            }
        });
}
