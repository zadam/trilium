const repository = require('../../src/services/repository');
const noteFulltextService = require('../../src/services/note_fulltext');

module.exports = async () => {
    const notes = await repository.getEntities('SELECT * FROM notes WHERE isDeleted = 0 AND isProtected = 0');

    for (const note of notes) {
        await noteFulltextService.updateNoteFulltext(note);
    }
};