const script = require('./script');
const Repository = require('./repository');

const repo = new Repository();

async function runNotesWithAttribute(runAttrValue) {
    const notes = await repo.getEntities(`
        SELECT notes.* 
        FROM notes 
          JOIN attributes ON attributes.noteId = notes.noteId
                           AND attributes.name = 'run' 
                           AND attributes.value = ? 
        WHERE
          notes.type = 'code'
          AND notes.isDeleted = 0`, [runAttrValue]);

    for (const note of notes) {
        script.executeNote(note);
    }
}

setTimeout(() => runNotesWithAttribute('on_startup'), 10 * 1000);

setInterval(() => runNotesWithAttribute('hourly'), 3600 * 1000);

setInterval(() => runNotesWithAttribute('daily'), 24 * 3600 * 1000);