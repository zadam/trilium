const scriptService = require('./script.js');
const cls = require('./cls.js');
const sqlInit = require('./sql_init.js');
const config = require('./config.js');
const log = require('./log.js');
const attributeService = require('../services/attributes.js');
const protectedSessionService = require('../services/protected_session.js');
const hiddenSubtreeService = require('./hidden_subtree.js');

/**
 * @param {BNote} note
 * @return {int[]}
 */
function getRunAtHours(note) {
    try {
        return note.getLabelValues('runAtHour').map(hour => parseInt(hour));
    }
    catch (e) {
        log.error(`Could not parse runAtHour for note ${note.noteId}: ${e.message}`);

        return [];
    }
}

function runNotesWithLabel(runAttrValue) {
    const instanceName = config.General ? config.General.instanceName : null;
    const currentHours = new Date().getHours();
    const notes = attributeService.getNotesWithLabel('run', runAttrValue);

    for (const note of notes) {
        const runOnInstances = note.getLabelValues('runOnInstance');
        const runAtHours = getRunAtHours(note);

        if ((runOnInstances.length === 0 || runOnInstances.includes(instanceName))
            && (runAtHours.length === 0 || runAtHours.includes(currentHours))
        ) {
            scriptService.executeNoteNoException(note, {originEntity: note});
        }
    }
}

sqlInit.dbReady.then(() => {
    cls.init(() => {
        hiddenSubtreeService.checkHiddenSubtree();
    });

    if (!process.env.TRILIUM_SAFE_MODE) {
        setTimeout(cls.wrap(() => runNotesWithLabel('backendStartup')), 10 * 1000);

        setInterval(cls.wrap(() => runNotesWithLabel('hourly')), 3600 * 1000);

        setInterval(cls.wrap(() => runNotesWithLabel('daily')), 24 * 3600 * 1000);

        setInterval(cls.wrap(() => hiddenSubtreeService.checkHiddenSubtree()), 7 * 3600 * 1000);
    }

    setInterval(() => protectedSessionService.checkProtectedSessionExpiration(), 30000);
});
