"use strict";

const sql = require('./sql');
const log = require('./log');
const Branch = require('../becca/entities/branch');
const entityChangesService = require('./entity_changes');
const protectedSessionService = require('./protected_session');
const becca = require('../becca/becca');

function getNotes(noteIds) {
    // we return also deleted notes which have been specifically asked for
    const notes = sql.getManyRows(`
        SELECT 
          noteId,
          title,
          isProtected,
          type,
          mime,
          isDeleted
        FROM notes
        WHERE noteId IN (???)`, noteIds);

    protectedSessionService.decryptNotes(notes);

    notes.forEach(note => {
        note.isProtected = !!note.isProtected
    });

    return notes;
}

function validateParentChild(parentNoteId, childNoteId, branchId = null) {
    if (childNoteId === 'root') {
        return { success: false, message: 'Cannot move root note.'};
    }

    if (parentNoteId === 'none') {
        // this shouldn't happen
        return { success: false, message: 'Cannot move anything into root parent.' };
    }

    const existing = getExistingBranch(parentNoteId, childNoteId);

    if (existing && (branchId === null || existing.branchId !== branchId)) {
        const parentNote = becca.getNote(parentNoteId);
        const childNote = becca.getNote(childNoteId);

        return {
            success: false,
            message: `Note "${childNote.title}" note already exists in the "${parentNote.title}".`
        };
    }

    if (!checkTreeCycle(parentNoteId, childNoteId)) {
        return {
            success: false,
            message: 'Moving/cloning note here would create cycle.'
        };
    }

    return { success: true };
}

function getExistingBranch(parentNoteId, childNoteId) {
    const branchId = sql.getValue(`
        SELECT branchId 
        FROM branches 
        WHERE noteId = ? 
          AND parentNoteId = ? 
          AND isDeleted = 0`, [childNoteId, parentNoteId]);

    return becca.getBranch(branchId);
}

/**
 * Tree cycle can be created when cloning or when moving existing clone. This method should detect both cases.
 */
function checkTreeCycle(parentNoteId, childNoteId) {
    const subtreeNoteIds = [];

    // we'll load the whole sub tree - because the cycle can start in one of the notes in the sub tree
    loadSubtreeNoteIds(childNoteId, subtreeNoteIds);

    function checkTreeCycleInner(parentNoteId) {
        if (parentNoteId === 'root') {
            return true;
        }

        if (subtreeNoteIds.includes(parentNoteId)) {
            // while towards the root of the tree we encountered noteId which is already present in the subtree
            // joining parentNoteId with childNoteId would then clearly create a cycle
            return false;
        }

        const parentNoteIds = sql.getColumn("SELECT DISTINCT parentNoteId FROM branches WHERE noteId = ? AND isDeleted = 0", [parentNoteId]);

        for (const pid of parentNoteIds) {
            if (!checkTreeCycleInner(pid)) {
                return false;
            }
        }

        return true;
    }

    return checkTreeCycleInner(parentNoteId);
}

function loadSubtreeNoteIds(parentNoteId, subtreeNoteIds) {
    subtreeNoteIds.push(parentNoteId);

    const children = sql.getColumn("SELECT noteId FROM branches WHERE parentNoteId = ? AND isDeleted = 0", [parentNoteId]);

    for (const childNoteId of children) {
        loadSubtreeNoteIds(childNoteId, subtreeNoteIds);
    }
}

function sortNotes(parentNoteId, customSortBy = 'title', reverse = false, foldersFirst = false) {
    if (!customSortBy) {
        customSortBy = 'title';
    }

    sql.transactional(() => {
        const notes = becca.getNote(parentNoteId).getChildNotes();

        const normalize = obj => (obj && typeof obj === 'string') ? obj.toLowerCase() : obj;

        notes.sort((a, b) => {
            if (foldersFirst) {
                const aHasChildren = a.hasChildren();
                const bHasChildren = b.hasChildren();

                if ((aHasChildren && !bHasChildren) || (!aHasChildren && bHasChildren)) {
                    // exactly one note of the two is a directory so the sorting will be done based on this status
                    return aHasChildren ? -1 : 1;
                }
            }

            function fetchValue(note, key) {
                const rawValue = ['title', 'dateCreated', 'dateModified'].includes(key)
                    ? note[key]
                    : note.getLabelValue(key);

                return normalize(rawValue);
            }

            function compare(a, b) {
                return b === null || b === undefined || a < b ? -1 : 1;
            }

            const topAEl = fetchValue(a, 'top');
            const topBEl = fetchValue(b, 'top');

            console.log(a.title, topAEl);
            console.log(b.title, topBEl);
            console.log("comp", compare(topAEl, topBEl) && !reverse);

            if (topAEl !== topBEl) {
                // since "top" should not be reversible, we'll reverse it once more to nullify this effect
                return compare(topAEl, topBEl) * (reverse ? -1 : 1);
            }

            const customAEl = fetchValue(a, customSortBy);
            const customBEl = fetchValue(b, customSortBy);

            if (customAEl !== customBEl) {
                return compare(customAEl, customBEl);
            }

            const titleAEl = fetchValue(a, 'title');
            const titleBEl = fetchValue(b, 'title');

            return compare(titleAEl, titleBEl);
        });

        if (reverse) {
            notes.reverse();
        }

        let position = 10;

        for (const note of notes) {
            const branch = note.getParentBranches().find(b => b.parentNoteId === parentNoteId);

            sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?",
                [position, branch.branchId]);

            becca.branches[branch.branchId].notePosition = position;

            position += 10;
        }

        entityChangesService.addNoteReorderingEntityChange(parentNoteId);
    });
}

function sortNotesIfNeeded(parentNoteId) {
    const parentNote = becca.getNote(parentNoteId);

    if (!parentNote) {
        return;
    }

    const sortedLabel = parentNote.getLabel('sorted');

    if (!sortedLabel || sortedLabel.value === 'off') {
        return;
    }

    sortNotes(parentNoteId, sortedLabel.value);
}

/**
 * @deprecated - this will be removed in the future
 */
function setNoteToParent(noteId, prefix, parentNoteId) {
    const parentNote = becca.getNote(parentNoteId);

    if (parentNote && parentNote.isDeleted) {
        throw new Error(`Cannot move note to deleted parent note ${parentNoteId}`);
    }

    // case where there might be more such branches is ignored. It's expected there should be just one
    const branchId = sql.getValue("SELECT branchId FROM branches WHERE isDeleted = 0 AND noteId = ? AND prefix = ?", [noteId, prefix]);
    const branch = becca.getBranch(branchId);

    if (branch) {
        if (!parentNoteId) {
            branch.markAsDeleted();
        }
        else {
            branch.parentNoteId = parentNoteId;
            branch.prefix = prefix;
            branch.save();
        }
    }
    else if (parentNoteId) {
        const note = becca.getNote(noteId);

        if (note.isDeleted) {
            throw new Error(`Cannot create a branch for ${noteId} which is deleted.`);
        }

        const branchId = sql.getValue('SELECT branchId FROM branches WHERE isDeleted = 0 AND noteId = ? AND parentNoteId = ?', [noteId, parentNoteId]);
        const branch = becca.getBranch(branchId);

        if (branch) {
            branch.prefix = prefix;
            branch.save();
        }
        else {
            new Branch({
                noteId: noteId,
                parentNoteId: parentNoteId,
                prefix: prefix
            }).save();
        }
    }
}

module.exports = {
    getNotes,
    validateParentChild,
    sortNotes,
    sortNotesIfNeeded,
    setNoteToParent
};
