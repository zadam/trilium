const scriptService = require('./script');
const repository = require('./repository');
const cls = require('./cls');
const sqlInit = require('./sql_init');
const config = require('./config');
const log = require('./log');

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
    const notes = repository.getEntities(`
        SELECT notes.* 
        FROM notes 
        JOIN attributes ON attributes.noteId = notes.noteId
                       AND attributes.isDeleted = 0
                       AND attributes.type = 'label'
                       AND attributes.name = 'run' 
                       AND attributes.value = ? 
        WHERE
          notes.type = 'code'
          AND notes.isDeleted = 0`, [runAttrValue]);

    const instanceName = config.General ? config.General.instanceName : null;
    const currentHours = new Date().getHours();

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
    if (!process.env.TRILIUM_SAFE_MODE) {
        setTimeout(cls.wrap(() => runNotesWithLabel('backendStartup')), 10 * 1000);

        setInterval(cls.wrap(() => runNotesWithLabel('hourly')), 3600 * 1000);

        setInterval(cls.wrap(() => runNotesWithLabel('daily')), 24 * 3600 * 1000);
    }
});
