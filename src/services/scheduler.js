const scriptService = require('./script');
const repository = require('./repository');
const cls = require('./cls');
const sqlInit = require('./sql_init');

async function runNotesWithLabel(runAttrValue) {
    const notes = await repository.getEntities(`
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

    for (const note of notes) {
        scriptService.executeNoteNoException(note, { originEntity: note });
    }
}

sqlInit.dbReady.then(() => {
    setTimeout(cls.wrap(() => runNotesWithLabel('backendStartup')), 10 * 1000);

    setInterval(cls.wrap(() => runNotesWithLabel('hourly')), 3600 * 1000);

    setInterval(cls.wrap(() => runNotesWithLabel('daily')), 24 * 3600 * 1000);
});