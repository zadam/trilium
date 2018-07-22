const fs = require('fs');
const dataDir = require('../services/data_dir');

fs.unlinkSync(dataDir.DOCUMENT_PATH);

require('../entities/entity_constructor');
const optionService = require('../services/options');
const sqlInit = require('../services/sql_init');
const myScryptService = require('../services/my_scrypt');
const passwordEncryptionService = require('../services/password_encryption');
const utils = require('../services/utils');
const noteService = require('../services/notes');
const cls = require('../services/cls');
const cloningService = require('../services/cloning');
const loremIpsum = require('lorem-ipsum');

async function setUserNamePassword() {
    const username = "test";
    const password = "test";

    await optionService.setOption('username', username);

    await optionService.setOption('passwordVerificationSalt', utils.randomSecureToken(32));
    await optionService.setOption('passwordDerivedKeySalt', utils.randomSecureToken(32));

    const passwordVerificationKey = utils.toBase64(await myScryptService.getVerificationHash(password));
    await optionService.setOption('passwordVerificationHash', passwordVerificationKey);

    await passwordEncryptionService.setDataKey(password, utils.randomSecureToken(16));

    await sqlInit.initDbConnection();
}

const noteCount = parseInt(process.argv[2]);
const notes = ['root'];

function getRandomParentNoteId() {
    const index = Math.floor(Math.random() * notes.length);

    return notes[index];
}

async function start() {
    await setUserNamePassword();

    for (let i = 0; i < noteCount; i++) {
        const title = loremIpsum({ count: 1, units: 'sentences', sentenceLowerBound: 1, sentenceUpperBound: 10 });

        const paragraphCount = Math.floor(Math.random() * Math.random() * 100);
        const content = loremIpsum({ count: paragraphCount, units: 'paragraphs', sentenceLowerBound: 1, sentenceUpperBound: 15,
            paragraphLowerBound: 3, paragraphUpperBound: 10, format: 'html' });

        const {note} = await noteService.createNote(getRandomParentNoteId(), title, content);

        console.log(`Created note ${i}: ${title}`);

        notes.push(note.noteId);
    }

    // we'll create clones for 20% of notes
    for (let i = 0; i < (noteCount / 50); i++) {
        const noteIdToClone = getRandomParentNoteId();
        const parentNoteId = getRandomParentNoteId();
        const prefix = Math.random() > 0.8 ? "prefix" : null;

        const result = await cloningService.cloneNoteToParent(noteIdToClone, parentNoteId, prefix);

        console.log(`Cloning ${i}:`, result.success ? "succeeded" : "FAILED");
    }

    process.exit(0);
}

sqlInit.dbReady.then(cls.wrap(start));