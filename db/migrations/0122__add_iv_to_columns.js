const sql = require('../../src/services/sql');

function prependIv(cipherText, ivText) {
    const arr = ivText.split("").map(c => parseInt(c) || 0);
    const iv = Buffer.from(arr);
    const payload = Buffer.from(cipherText, 'base64');
    const complete = Buffer.concat([iv, payload]);

    return complete.toString('base64');
}

async function updateEncryptedDataKey() {
    const encryptedDataKey = await sql.getValue("SELECT value FROM options WHERE name = 'encryptedDataKey'");
    const encryptedDataKeyIv = await sql.getValue("SELECT value FROM options WHERE name = 'encryptedDataKeyIv'");

    const newEncryptedDataKey = prependIv(encryptedDataKey, encryptedDataKeyIv);

    await sql.execute("UPDATE options SET value = ? WHERE name = 'encryptedDataKey'", [newEncryptedDataKey]);

    await sql.execute("DELETE FROM options WHERE name = 'encryptedDataKeyIv'");
    await sql.execute("DELETE FROM sync WHERE entityName = 'options' AND entityId = 'encryptedDataKeyIv'");
}

async function updateNotes() {
    const protectedNotes = await sql.getRows("SELECT noteId, title, content FROM notes WHERE isProtected = 1");

    for (const note of protectedNotes) {
        if (note.title !== null) {
            note.title = prependIv(note.title, "0" + note.noteId);
        }

        if (note.content !== null) {
            note.content = prependIv(note.content, "1" + note.noteId);
        }

        await sql.execute("UPDATE notes SET title = ?, content = ? WHERE noteId = ?", [note.title, note.content, note.noteId]);
    }
}

async function updateNoteRevisions() {
    const protectedNoteRevisions = await sql.getRows("SELECT noteRevisionId, title, content FROM note_revisions WHERE isProtected = 1");

    for (const noteRevision of protectedNoteRevisions) {
        if (noteRevision.title !== null) {
            noteRevision.title = prependIv(noteRevision.title, "0" + noteRevision.noteRevisionId);
        }

        if (noteRevision.content !== null) {
            noteRevision.content = prependIv(noteRevision.content, "1" + noteRevision.noteRevisionId);
        }

        await sql.execute("UPDATE note_revisions SET title = ?, content = ? WHERE noteRevisionId = ?", [noteRevision.title, noteRevision.content, noteRevision.noteRevisionId]);
    }
}

module.exports = async () => {
    await updateEncryptedDataKey();

    await updateNotes();

    await updateNoteRevisions();
};