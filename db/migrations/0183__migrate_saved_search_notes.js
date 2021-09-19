const repository = require('../../src/services/repository');

module.exports = () => {
    for (const note of repository.getEntities("SELECT * FROM notes WHERE type = 'search' AND isProtected = 0 AND isDeleted = 0")) {
        try {
            let origContent = note.getJsonContent();

            if (!origContent) {
                continue;
            }

            note.addLabel('searchString', origContent.searchString);

            note.setContent('');

            note.mime = 'plain';
            note.save();

            console.log(`Migrated search note ${note.noteId}`);
        }
        catch (e) {
            console.log(`Changing note content for note ${note.noteId} failed with: ${e.message} ${e.stack}`);
        }
    }
};
