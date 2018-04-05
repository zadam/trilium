const scriptService = require('./script');
const repository = require('./repository');
const cls = require('./cls');

async function runNotesWithLabel(runAttrValue) {
    const notes = await repository.getEntities(`
        SELECT notes.* 
        FROM notes 
          JOIN labels ON labels.noteId = notes.noteId
                           AND labels.isDeleted = 0
                           AND labels.name = 'run' 
                           AND labels.value = ? 
        WHERE
          notes.type = 'code'
          AND notes.isDeleted = 0`, [runAttrValue]);

    for (const note of notes) {
        scriptService.executeNote(note);
    }
}

setTimeout(() => cls.wrap(() => runNotesWithLabel('backendStartup')), 10 * 1000);

setInterval(() => cls.wrap(() => runNotesWithLabel('hourly')), 3600 * 1000);

setInterval(() => cls.wrap(() => runNotesWithLabel('daily'), 24 * 3600 * 1000));