"use strict";

const noteCache = require('./note_cache');
const hoistedNoteService = require('../hoisted_note');
const protectedSessionService = require('../protected_session');
const log = require('../log');

function isNotePathArchived(notePath) {
    const noteId = notePath[notePath.length - 1];
    const note = noteCache.notes[noteId];

    if (note.isArchived) {
        return true;
    }

    for (let i = 0; i < notePath.length - 1; i++) {
        const note = noteCache.notes[notePath[i]];

        // this is going through parents so archived must be inheritable
        if (note.hasInheritableOwnedArchivedLabel) {
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
 * @return {boolean} - true if given noteId has ancestorNoteId in any of its paths (even archived)
 */
function isInAncestor(noteId, ancestorNoteId) {
    if (ancestorNoteId === 'root' || ancestorNoteId === noteId) {
        return true;
    }

    const note = noteCache.notes[noteId];

    for (const parentNote of note.parents) {
        if (isInAncestor(parentNote.noteId, ancestorNoteId)) {
            return true;
        }
    }

    return false;
}

function getNoteTitle(childNoteId, parentNoteId) {
    const childNote = noteCache.notes[childNoteId];
    const parentNote = noteCache.notes[parentNoteId];

    if (!childNote) {
        log.info(`Cannot find note in cache for noteId ${childNoteId}`);
        return "[error fetching title]";
    }

    let title;

    if (childNote.isProtected) {
        title = protectedSessionService.isProtectedSessionAvailable() ? childNote.title : '[protected]';
    }
    else {
        title = childNote.title;
    }

    const branch = parentNote ? noteCache.getBranch(childNote.noteId, parentNote.noteId) : null;

    return ((branch && branch.prefix) ? `${branch.prefix} - ` : '') + title;
}

function getNoteTitleArrayForPath(notePathArray) {
    const titles = [];

    if (notePathArray[0] === hoistedNoteService.getHoistedNoteId() && notePathArray.length === 1) {
        return [ getNoteTitle(hoistedNoteService.getHoistedNoteId()) ];
    }

    let parentNoteId = 'root';
    let hoistedNotePassed = false;

    for (const noteId of notePathArray) {
        // start collecting path segment titles only after hoisted note
        if (hoistedNotePassed) {
            const title = getNoteTitle(noteId, parentNoteId);

            titles.push(title);
        }

        if (noteId === hoistedNoteService.getHoistedNoteId()) {
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
 * Archived notes are also returned, but non-archived paths are preferred if available
 * - this means that archived paths is returned only if there's no non-archived path
 * - you can check whether returned path is archived using isArchived()
 */
function getSomePath(note, path = []) {
    if (note.noteId === 'root') {
        path.push(note.noteId);
        path.reverse();

        if (!path.includes(hoistedNoteService.getHoistedNoteId())) {
            return false;
        }

        return path;
    }

    const parents = note.parents;
    if (parents.length === 0) {
        return false;
    }

    for (const parentNote of parents) {
        const retPath = getSomePath(parentNote, path.concat([note.noteId]));

        if (retPath) {
            return retPath;
        }
    }

    return false;
}

function getNotePath(noteId) {
    const note = noteCache.notes[noteId];

    if (!note) {
        console.trace(`Cannot find note ${noteId} in cache.`);
        return;
    }

    const retPath = getSomePath(note);

    if (retPath) {
        const noteTitle = getNoteTitleForPath(retPath);
        const parentNote = note.parents[0];

        return {
            noteId: noteId,
            branchId: noteCache.getBranch(noteId, parentNote.noteId).branchId,
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
