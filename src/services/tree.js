"use strict";

const sql = require('./sql.js');
const log = require('./log.js');
const BBranch = require('../becca/entities/bbranch.js');
const entityChangesService = require('./entity_changes.js');
const becca = require('../becca/becca.js');

function validateParentChild(parentNoteId, childNoteId, branchId = null) {
    if (['root', '_hidden', '_share', '_lbRoot', '_lbAvailableLaunchers', '_lbVisibleLaunchers'].includes(childNoteId)) {
        return { branch: null, success: false, message: `Cannot change this note's location.` };
    }

    if (parentNoteId === 'none') {
        // this shouldn't happen
        return { branch: null, success: false, message: `Cannot move anything into 'none' parent.` };
    }

    const existingBranch = becca.getBranchFromChildAndParent(childNoteId, parentNoteId);

    if (existingBranch && existingBranch.branchId !== branchId) {
        const parentNote = becca.getNote(parentNoteId);
        const childNote = becca.getNote(childNoteId);

        return {
            branch: existingBranch,
            success: false,
            message: `Note "${childNote.title}" note already exists in the "${parentNote.title}".`
        };
    }

    if (wouldAddingBranchCreateCycle(parentNoteId, childNoteId)) {
        return {
            branch: null,
            success: false,
            message: 'Moving/cloning note here would create cycle.'
        };
    }

    if (parentNoteId !== '_lbBookmarks' && becca.getNote(parentNoteId).type === 'launcher') {
        return {
            branch: null,
            success: false,
            message: 'Launcher note cannot have any children.'
        };
    }

    return { branch: null, success: true };
}

/**
 * Tree cycle can be created when cloning or when moving existing clone. This method should detect both cases.
 */
function wouldAddingBranchCreateCycle(parentNoteId, childNoteId) {
    if (parentNoteId === childNoteId) {
        return true;
    }

    const childNote = becca.getNote(childNoteId);
    const parentNote = becca.getNote(parentNoteId);

    if (!childNote || !parentNote) {
        return false;
    }

    // we'll load the whole subtree - because the cycle can start in one of the notes in the subtree
    const childSubtreeNoteIds = new Set(childNote.getSubtreeNoteIds());
    const parentAncestorNoteIds = parentNote.getAncestorNoteIds();

    return parentAncestorNoteIds.some(parentAncestorNoteId => childSubtreeNoteIds.has(parentAncestorNoteId));
}

function sortNotes(parentNoteId, customSortBy = 'title', reverse = false, foldersFirst = false, sortNatural = false, sortLocale) {
    if (!customSortBy) {
        customSortBy = 'title';
    }

    if (!sortLocale) {
        // sortLocale can not be empty string or null value, default value must be set to undefined.
        sortLocale = undefined;
    }

    sql.transactional(() => {
        const notes = becca.getNote(parentNoteId).getChildNotes();

        const normalize = obj => (obj && typeof obj === 'string') ? obj.toLowerCase() : obj;

        notes.sort((a, b) => {
            if (foldersFirst) {
                const aHasChildren = a.hasChildren();
                const bHasChildren = b.hasChildren();

                if ((aHasChildren && !bHasChildren) || (!aHasChildren && bHasChildren)) {
                    // exactly one note of the two is a directory, so the sorting will be done based on this status
                    return aHasChildren ? -1 : 1;
                }
            }

            function fetchValue(note, key) {
                let rawValue;

                if (key === 'title') {
                    const branch = note.getParentBranches().find(branch => branch.parentNoteId === parentNoteId);
                    const prefix = branch?.prefix;
                    rawValue = prefix ? `${prefix} - ${note.title}` : note.title;
                } else {
                    rawValue = ['dateCreated', 'dateModified'].includes(key)
                        ? note[key]
                        : note.getLabelValue(key);
                }

                return normalize(rawValue);
            }

            function compare(a, b) {
                if (!sortNatural) {
                    // alphabetical sort
                    return b === null || b === undefined || a < b ? -1 : 1;
                } else {
                    // natural sort
                    return a.localeCompare(b, sortLocale, {numeric: true, sensitivity: 'base'});
                }
            }

            const topAEl = fetchValue(a, 'top');
            const topBEl = fetchValue(b, 'top');

            if (topAEl !== topBEl) {
                // since "top" should not be reversible, we'll reverse it once more to nullify this effect
                return compare(topAEl, topBEl) * (reverse ? -1 : 1);
            }

            const bottomAEl = fetchValue(a, 'bottom');
            const bottomBEl = fetchValue(b, 'bottom');

            if (bottomAEl !== bottomBEl) {
                // since "bottom" should not be reversible, we'll reverse it once more to nullify this effect
                return compare(bottomBEl, bottomAEl) * (reverse ? -1 : 1);
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
        let someBranchUpdated = false;

        for (const note of notes) {
            const branch = note.getParentBranches().find(b => b.parentNoteId === parentNoteId);

            if (branch.noteId === '_hidden') {
                position = 999_999_999;
            }

            if (branch.notePosition !== position) {
                sql.execute("UPDATE branches SET notePosition = ? WHERE branchId = ?",
                    [position, branch.branchId]);

                branch.notePosition = position;
                someBranchUpdated = true;
            }

            position += 10;
        }

        if (someBranchUpdated) {
            entityChangesService.putNoteReorderingEntityChange(parentNoteId);
        }
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

    const sortReversed = parentNote.getLabelValue('sortDirection')?.toLowerCase() === "desc";
    const sortFoldersFirst = parentNote.isLabelTruthy('sortFoldersFirst');
    const sortNatural = parentNote.isLabelTruthy('sortNatural');
    const sortLocale = parentNote.getLabelValue('sortLocale');

    sortNotes(parentNoteId, sortedLabel.value, sortReversed, sortFoldersFirst, sortNatural, sortLocale);
}

/**
 * @deprecated this will be removed in the future
 */
function setNoteToParent(noteId, prefix, parentNoteId) {
    const parentNote = becca.getNote(parentNoteId);

    if (parentNoteId && !parentNote) {
        // null parentNoteId is a valid value
        throw new Error(`Cannot move note to deleted / missing parent note '${parentNoteId}'`);
    }

    // case where there might be more such branches is ignored. It's expected there should be just one
    const branchId = sql.getValue("SELECT branchId FROM branches WHERE isDeleted = 0 AND noteId = ? AND prefix = ?", [noteId, prefix]);
    const branch = becca.getBranch(branchId);

    if (branch) {
        if (!parentNoteId) {
            log.info(`Removing note '${noteId}' from parent '${parentNoteId}'`);

            branch.markAsDeleted();
        }
        else {
            const newBranch = branch.createClone(parentNoteId);
            newBranch.save();

            branch.markAsDeleted();
        }
    }
    else if (parentNoteId) {
        const note = becca.getNote(noteId);

        if (note.isDeleted) {
            throw new Error(`Cannot create a branch for '${noteId}' which is deleted.`);
        }

        const branchId = sql.getValue('SELECT branchId FROM branches WHERE isDeleted = 0 AND noteId = ? AND parentNoteId = ?', [noteId, parentNoteId]);
        const branch = becca.getBranch(branchId);

        if (branch) {
            branch.prefix = prefix;
            branch.save();
        }
        else {
            new BBranch({
                noteId: noteId,
                parentNoteId: parentNoteId,
                prefix: prefix
            }).save();
        }
    }
}

module.exports = {
    validateParentChild,
    sortNotes,
    sortNotesIfNeeded,
    setNoteToParent
};
