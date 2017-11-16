const sql = require('../services/sql');
const data_encryption = require('../services/data_encryption');
const password_encryption = require('../services/password_encryption');
const my_scrypt = require('../services/my_scrypt');
const readline = require('readline');

const cl = readline.createInterface(process.stdin, process.stdout);

function question(q) {
    return new Promise( (res, rej) => {
        cl.question( q, answer => {
            res(answer);
        })
    });
}

module.exports = async () => {
    const password = await question("Enter password: ");
    const dataKey = await password_encryption.getDecryptedDataKey(password);

    const protectedNotes = await sql.getResults("SELECT * FROM notes WHERE is_protected = 1");

    for (const note of protectedNotes) {
        console.log("Encrypted: ", note.note_title);

        const decryptedTitle = data_encryption.decrypt(dataKey, note.note_title);

        console.log("Decrypted title: ", decryptedTitle);

        note.note_title = data_encryption.encryptCbc(dataKey, "0" + note.note_id, decryptedTitle);

        const decryptedText = data_encryption.decrypt(dataKey, note.note_text);
        note.note_text = data_encryption.encryptCbc(dataKey, "1" + note.note_id, decryptedText);

        await sql.execute("UPDATE notes SET note_title = ?, note_text = ? WHERE note_id = ?", [note.note_title, note.note_text, note.note_id]);
    }

    const protectedNotesHistory = await sql.getResults("SELECT * FROM notes_history WHERE is_protected = 1");

    for (const noteHistory of protectedNotesHistory) {
        const decryptedTitle = data_encryption.decrypt(dataKey, noteHistory.note_title);
        noteHistory.note_title = data_encryption.encryptCbc(dataKey, "0" + noteHistory.note_history_id, decryptedTitle);

        const decryptedText = data_encryption.decrypt(dataKey, noteHistory.note_text);
        noteHistory.note_text = data_encryption.encryptCbc(dataKey, "1" + noteHistory.note_history_id, decryptedText);

        await sql.execute("UPDATE notes SET note_title = ?, note_text = ? WHERE note_id = ?", [noteHistory.note_title, noteHistory.note_text, noteHistory.note_history_id]);
    }

    const passwordDerivedKey = await my_scrypt.getPasswordDerivedKey(password);

    // trimming to 128bits (for AES-128)
    const trimmedDataKey = dataKey.slice(0, 16);

    await password_encryption.encryptDataKey(passwordDerivedKey, trimmedDataKey);
};