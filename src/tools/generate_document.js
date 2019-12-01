/**
 * Usage: node src/tools/generate_document.js 1000
 * will create 1000 new notes and some clones into a current document.db
 */

require('../entities/entity_constructor');
const sqlInit = require('../services/sql_init');
const noteService = require('../services/notes');
const attributeService = require('../services/attributes');
const cls = require('../services/cls');
const cloningService = require('../services/cloning');
const loremIpsum = require('lorem-ipsum').loremIpsum;

const noteCount = parseInt(process.argv[2]);

if (!noteCount) {
    console.error(`Please enter number of notes as program parameter.`);
    process.exit(1);
}

const notes = ['root'];

function getRandomNoteId() {
    const index = Math.floor(Math.random() * notes.length);

    return notes[index];
}

async function start() {
    for (let i = 0; i < noteCount; i++) {
        const title = loremIpsum({ count: 1, units: 'sentences', sentenceLowerBound: 1, sentenceUpperBound: 10 });

        const paragraphCount = Math.floor(Math.random() * Math.random() * 100);
        const content = loremIpsum({ count: paragraphCount, units: 'paragraphs', sentenceLowerBound: 1, sentenceUpperBound: 15,
            paragraphLowerBound: 3, paragraphUpperBound: 10, format: 'html' });

        const {note} = await noteService.createNewNote({
            parentNoteId: getRandomNoteId(),
            title,
            content,
            type: 'text'
        });

        console.log(`Created note ${i}: ${title}`);

        notes.push(note.noteId);
    }

    // we'll create clones for 4% of notes
    for (let i = 0; i < (noteCount / 25); i++) {
        const noteIdToClone = getRandomNoteId();
        const parentNoteId = getRandomNoteId();
        const prefix = Math.random() > 0.8 ? "prefix" : null;

        const result = await cloningService.cloneNoteToParent(noteIdToClone, parentNoteId, prefix);

        console.log(`Cloning ${i}:`, result.success ? "succeeded" : "FAILED");
    }

    for (let i = 0; i < noteCount; i++) {
        await attributeService.createAttribute({
            noteId: getRandomNoteId(),
            type: 'label',
            name: 'label',
            value: 'value',
            isInheritable: Math.random() > 0.1 // 10% are inheritable
        });

        console.log(`Creating label ${i}`);
    }

    for (let i = 0; i < noteCount; i++) {
        await attributeService.createAttribute({
            noteId: getRandomNoteId(),
            type: 'relation',
            name: 'relation',
            value: getRandomNoteId(),
            isInheritable: Math.random() > 0.1 // 10% are inheritable
        });

        console.log(`Creating relation ${i}`);
    }

    process.exit(0);
}

sqlInit.dbReady.then(cls.wrap(start));