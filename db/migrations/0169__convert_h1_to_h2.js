const repository = require('../../src/services/repository');

module.exports = () => {
    for (const note of repository.getEntities("SELECT * FROM notes WHERE type = 'text' AND isProtected = 0")) {
        try {
            let origContent = note.getContent();

            const newContent = origContent
                .replace(/<h1/ig, "<h2")
                .replace(/<\/h1/ig, "</h2");

            if (newContent !== origContent) {
                note.setContent(newContent);
            }
        }
        catch (e) {
            console.log(`Changing note content for note ${note.noteId} failed with: ${e.message} ${e.stack}`);
        }
    }
};
