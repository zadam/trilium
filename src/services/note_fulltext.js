const sql = require('./sql');
const repository = require('./repository');
const html2plaintext = require('html2plaintext');

const noteIdQueue = [];

async function updateNoteFulltext(note) {
    if (note.isDeleted || note.isProtected || note.hasLabel('archived')) {
        await sql.execute(`DELETE
                           FROM note_fulltext
                           WHERE noteId = ?`, [note.noteId]);
    } else {
        let content = null;
        let contentHash = null;

        if (['text', 'code'].includes(note.type)) {
            const noteContent = await note.getNoteContent();
            content = noteContent.content;

            if (note.type === 'text' && note.mime === 'text/html') {
                content = html2plaintext(content);
            }

            contentHash = noteContent.hash;
        }

        // optimistically try to update first ...
        const res = await sql.execute(`UPDATE note_fulltext title = ?, titleHash = ?, content = ?, contentHash = ? WHERE noteId = ?`, [note.title, note.hash, content, contentHash, note.noteId]);

        // ... and insert only when the update did not work
        if (res.stmt.changes === 0) {
            await sql.execute(`INSERT INTO note_fulltext (title, titleHash, content, contentHash, noteId)
                               VALUES (?, ?, ?, ?, ?)`, [note.title, note.hash, content, contentHash, note.noteId]);
        }
    }
}

async function triggerNoteFulltextUpdate(noteId) {
    if (!noteIdQueue.includes(noteId)) {
        noteIdQueue.push(noteId);
    }

    while (noteIdQueue.length > 0) {
        await sql.transactional(async () => {
            if (noteIdQueue.length === 0) {
                return;
            }

            const noteId = noteIdQueue.shift();
            const note = await repository.getNote(noteId);

            await updateNoteFulltext(note);
        });
    }
}

module.exports = {
    triggerNoteFulltextUpdate,
    updateNoteFulltext
};