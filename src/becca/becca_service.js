"use strict";

const becca = require('./becca.js');
const cls = require('../services/cls.js');
const log = require('../services/log.js');

function isNotePathArchived(notePath) {
    const noteId = notePath[notePath.length - 1];
    const note = becca.notes[noteId];

    if (note.isArchived) {
        return true;
    }

    for (let i = 0; i < notePath.length - 1; i++) {
        const note = becca.notes[notePath[i]];

        // this is going through parents so archived must be inheritable
        if (note.hasInheritableArchivedLabel()) {
            return true;
        }
    }

    return false;
}

function getNoteTitle(childNoteId, parentNoteId) {
    const childNote = becca.notes[childNoteId];
    const parentNote = becca.notes[parentNoteId];

    if (!childNote) {
        log.info(`Cannot find note '${childNoteId}'`);
        return "[error fetching title]";
    }

    const title = childNote.getTitleOrProtected();

    const branch = parentNote ? becca.getBranchFromChildAndParent(childNote.noteId, parentNote.noteId) : null;

    return `${(branch && branch.prefix) ? `${branch.prefix} - ` : ''}${title}`;
}

function getNoteTitleArrayForPath(notePathArray) {
    if (!notePathArray || !Array.isArray(notePathArray)) {
        throw new Error(`${notePathArray} is not an array.`);
    }

    if (notePathArray.length === 1) {
        return [getNoteTitle(notePathArray[0])];
    }

    const titles = [];

    let parentNoteId = 'root';
    let hoistedNotePassed = false;

    // this is a notePath from outside of hoisted subtree, so the full title path needs to be returned
    const hoistedNoteId = cls.getHoistedNoteId();
    const outsideOfHoistedSubtree = !notePathArray.includes(hoistedNoteId);

    for (const noteId of notePathArray) {
        // start collecting path segment titles only after hoisted note
        if (hoistedNotePassed) {
            const title = getNoteTitle(noteId, parentNoteId);

            titles.push(title);
        }

        if (!hoistedNotePassed && (noteId === hoistedNoteId || outsideOfHoistedSubtree)) {
            hoistedNotePassed = true;
        }

        parentNoteId = noteId;
    }

    return titles;
}

function getNoteTitleForPath(notePathArray) {
    const titles = getNoteTitleArrayForPath(notePathArray);

    return titles.join(' / ');
}

module.exports = {
    getNoteTitle,
    getNoteTitleForPath,
    isNotePathArchived
};
