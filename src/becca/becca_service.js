"use strict";

const becca = require('./becca');
const cls = require('../services/cls');
const log = require('../services/log');

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

/**
 * This assumes that note is available. "archived" note means that there isn't a single non-archived note-path
 * leading to this note.
 *
 * @param noteId
 */
function isArchived(noteId) {
    const notePath = getSomePath(noteId);

    return isNotePathArchived(notePath);
}

/**
 * @param {string} noteId
 * @param {string} ancestorNoteId
 * @returns {boolean} - true if given noteId has ancestorNoteId in any of its paths (even archived)
 */
function isInAncestor(noteId, ancestorNoteId) {
    if (ancestorNoteId === 'root' || ancestorNoteId === noteId) {
        return true;
    }

    const note = becca.notes[noteId];

    if (!note) {
        return false;
    }

    for (const parentNote of note.parents) {
        if (isInAncestor(parentNote.noteId, ancestorNoteId)) {
            return true;
        }
    }

    return false;
}

function getNoteTitle(childNoteId, parentNoteId) {
    const childNote = becca.notes[childNoteId];
    const parentNote = becca.notes[parentNoteId];

    if (!childNote) {
        log.info(`Cannot find note in cache for noteId '${childNoteId}'`);
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

    // this is a notePath from outside of hoisted subtree so full title path needs to be returned
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

/**
 * Returns notePath for noteId from cache. Note hoisting is respected.
 * Archived (and hidden) notes are also returned, but non-archived paths are preferred if available
 * - this means that archived paths is returned only if there's no non-archived path
 * - you can check whether returned path is archived using isArchived
 *
 * @param {BNote} note
 * @param {string[]} path
 */
function getSomePath(note, path = []) {
    // first try to find note within hoisted note, otherwise take any existing note path
    return getSomePathInner(note, path, true)
        || getSomePathInner(note, path, false);
}

/**
 * @param {BNote} note
 * @param {string[]} path
 * @param {boolean}respectHoisting
 * @returns {string[]|false}
 */
function getSomePathInner(note, path, respectHoisting) {
    if (note.isRoot()) {
        const foundPath = [...path, note.noteId];
        foundPath.reverse();

        if (respectHoisting && !foundPath.includes(cls.getHoistedNoteId())) {
            return false;
        }

        return foundPath;
    }

    const parents = note.parents;
    if (parents.length === 0) {
        console.log(`Note '${note.noteId}' - '${note.title}' has no parents.`);

        return false;
    }

    for (const parentNote of parents) {
        const retPath = getSomePathInner(parentNote, [...path, note.noteId], respectHoisting);

        if (retPath) {
            return retPath;
        }
    }

    return false;
}

function getNotePath(noteId) {
    const note = becca.notes[noteId];

    if (!note) {
        console.trace(`Cannot find note '${noteId}' in cache.`);
        return;
    }

    const retPath = getSomePath(note);

    if (retPath) {
        const noteTitle = getNoteTitleForPath(retPath);

        let branchId;

        if (note.isRoot()) {
            branchId = 'none_root';
        }
        else {
            const parentNote = note.parents[0];
            branchId = becca.getBranchFromChildAndParent(noteId, parentNote.noteId).branchId;
        }

        return {
            noteId: noteId,
            branchId: branchId,
            title: noteTitle,
            notePath: retPath,
            path: retPath.join('/')
        };
    }
}

/**
 * @param noteId
 * @returns {boolean} - true if note exists (is not deleted) and is available in current note hoisting
 */
function isAvailable(noteId) {
    const notePath = getNotePath(noteId);

    return !!notePath;
}

module.exports = {
    getSomePath,
    getNotePath,
    getNoteTitle,
    getNoteTitleForPath,
    isAvailable,
    isArchived,
    isInAncestor,
    isNotePathArchived
};
