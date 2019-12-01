/**
 * Usage: node src/tools/generate_document.js 1000
 * will create 1000 new notes and some clones into a current document.db
 */

require('../entities/entity_constructor');
const sqlInit = require('../services/sql_init');
const noteService = require('../services/notes');
const cls = require('../services/cls');
const cloningService = require('../services/cloning');
const loremIpsum = require('lorem-ipsum').loremIpsum;

const noteCount = parseInt(process.argv[2]);

if (!noteCount) {
    console.error(`Please enter number of notes as program parameter.`);
    process.exit(1);
}

const notes = ['root'];

function getRandomParentNoteId() {
    const index = Math.floor(Math.random() * notes.length);

    return notes[index];
}

async function start() {
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