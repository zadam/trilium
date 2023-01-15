"use strict";

const BNote = require('./bnote');
const AbstractBeccaEntity = require("./abstract_becca_entity");
const dateUtils = require("../../services/date_utils");
const utils = require("../../services/utils");
const TaskContext = require("../../services/task_context");
const cls = require("../../services/cls");
const log = require("../../services/log");

/**
 * Branch represents a relationship between a child note and its parent note. Trilium allows a note to have multiple
 * parents.
 *
 * Note that you should not rely on the branch's identity, since it can change easily with a note's move.
 * Always check noteId instead.
 *
 * @extends AbstractBeccaEntity
 */
class BBranch extends AbstractBeccaEntity {
    static get entityName() { return "branches"; }
    static get primaryKeyName() { return "branchId"; }
    // notePosition is not part of hash because it would produce a lot of updates in case of reordering
    static get hashedProperties() { return ["branchId", "noteId", "parentNoteId", "prefix"]; }

    constructor(row) {
        super();

        if (!row) {
            return;
        }

        this.updateFromRow(row);
        this.init();
    }

    updateFromRow(row) {
        this.update([
            row.branchId,
            row.noteId,
            row.parentNoteId,
            row.prefix,
            row.notePosition,
            row.isExpanded,
            row.utcDateModified
        ]);
    }

    update([branchId, noteId, parentNoteId, prefix, notePosition, isExpanded, utcDateModified]) {
        /** @type {string} */
        this.branchId = branchId;
        /** @type {string} */
        this.noteId = noteId;
        /** @type {string} */
        this.parentNoteId = parentNoteId;
        /** @type {string|null} */
        this.prefix = prefix;
        /** @type {int} */
        this.notePosition = notePosition;
        /** @type {boolean} */
        this.isExpanded = !!isExpanded;
        /** @type {string} */
        this.utcDateModified = utcDateModified;

        return this;
    }

    init() {
        if (this.branchId) {
            this.becca.branches[this.branchId] = this;
        }

        this.becca.childParentToBranch[`${this.noteId}-${this.parentNoteId}`] = this;

        const childNote = this.childNote;

        if (!childNote.parentBranches.includes(this)) {
            childNote.parentBranches.push(this);
        }

        if (this.noteId === 'root') {
            return;
        }

        const parentNote = this.parentNote;

        if (!childNote.parents.includes(parentNote)) {
            childNote.parents.push(parentNote);
        }

        if (!parentNote.children.includes(childNote)) {
            parentNote.children.push(childNote);
        }
    }

    /** @returns {BNote} */
    get childNote() {
        if (!(this.noteId in this.becca.notes)) {
            // entities can come out of order in sync/import, create skeleton which will be filled later
            this.becca.addNote(this.noteId, new BNote({noteId: this.noteId}));
        }

        return this.becca.notes[this.noteId];
    }

    getNote() {
        return this.childNote;
    }

    /** @returns {BNote|undefined} - root branch will have undefined parent, all other branches have to have a parent note */
    get parentNote() {
        if (!(this.parentNoteId in this.becca.notes) && this.parentNoteId !== 'none') {
            // entities can come out of order in sync/import, create skeleton which will be filled later
            this.becca.addNote(this.parentNoteId, new BNote({noteId: this.parentNoteId}));
        }

        return this.becca.notes[this.parentNoteId];
    }

    get isDeleted() {
        return !(this.branchId in this.becca.branches);
    }

    /**
     * Branch is weak when its existence should not hinder deletion of its note.
     * As a result, note with only weak branches should be immediately deleted.
     * An example is shared or bookmarked clones - they are created automatically and exist for technical reasons,
     * not as user-intended actions. From user perspective, they don't count as real clones and for the purpose
     * of deletion should not act as a clone.
     *
     * @returns {boolean}
     */
    get isWeak() {
        return ['_share', '_lbBookmarks'].includes(this.parentNoteId);
    }

    /**
     * Delete a branch. If this is a last note's branch, delete the note as well.
     *
     * @param {string} [deleteId] - optional delete identified
     * @param {TaskContext} [taskContext]
     *
     * @returns {boolean} - true if note has been deleted, false otherwise
     */
    deleteBranch(deleteId, taskContext) {
        if (!deleteId) {
            deleteId = utils.randomString(10);
        }

        if (!taskContext) {
            taskContext = new TaskContext('no-progress-reporting');
        }

        taskContext.increaseProgressCount();

        const note = this.getNote();

        if (!taskContext.noteDeletionHandlerTriggered) {
            const parentBranches = note.getParentBranches();

            if (parentBranches.length === 1 && parentBranches[0] === this) {
                // needs to be run before branches and attributes are deleted and thus attached relations disappear
                const handlers = require("../../services/handlers");
                handlers.runAttachedRelations(note, 'runOnNoteDeletion', note);
            }
        }

        if (this.noteId === 'root'
            || this.noteId === cls.getHoistedNoteId()) {

            throw new Error("Can't delete root or hoisted branch/note");
        }

        this.markAsDeleted(deleteId);

        const notDeletedBranches = note.getStrongParentBranches();

        if (notDeletedBranches.length === 0) {
            for (const weakBranch of note.getParentBranches()) {
                weakBranch.markAsDeleted(deleteId);
            }

            for (const childBranch of note.getChildBranches()) {
                childBranch.deleteBranch(deleteId, taskContext);
            }

            // first delete children and then parent - this will show up better in recent changes

            log.info(`Deleting note ${note.noteId}`);

            this.becca.notes[note.noteId].isBeingDeleted = true;

            for (const attribute of note.getOwnedAttributes()) {
                attribute.markAsDeleted(deleteId);
            }

            for (const relation of note.getTargetRelations()) {
                relation.markAsDeleted(deleteId);
            }

            note.markAsDeleted(deleteId);

            return true;
        }
        else {
            return false;
        }
    }

    beforeSaving() {
        if (!this.noteId || !this.parentNoteId) {
            throw new Error(`noteId and parentNoteId are mandatory properties for Branch`);
        }

        this.branchId = `${this.parentNoteId}_${this.noteId}`;

        if (this.notePosition === undefined || this.notePosition === null) {
            let maxNotePos = 0;

            for (const childBranch of this.parentNote.getChildBranches()) {
                if (maxNotePos < childBranch.notePosition
                    && childBranch.noteId !== '_hidden' // hidden has very large notePosition to always stay last
                ) {
                    maxNotePos = childBranch.notePosition;
                }
            }

            this.notePosition = maxNotePos + 10;
        }

        if (!this.isExpanded) {
            this.isExpanded = false;
        }

        if (!this.prefix?.trim()) {
            this.prefix = null;
        }

        this.utcDateModified = dateUtils.utcNowDateTime();

        super.beforeSaving();

        this.becca.branches[this.branchId] = this;
    }

    getPojo() {
        return {
            branchId: this.branchId,
            noteId: this.noteId,
            parentNoteId: this.parentNoteId,
            prefix: this.prefix,
            notePosition: this.notePosition,
            isExpanded: this.isExpanded,
            isDeleted: false,
            utcDateModified: this.utcDateModified
        };
    }

    createClone(parentNoteId, notePosition) {
        const existingBranch = this.becca.getBranchFromChildAndParent(this.noteId, parentNoteId);

        if (existingBranch) {
            existingBranch.notePosition = notePosition;
            return existingBranch;
        } else {
            return new BBranch({
                noteId: this.noteId,
                parentNoteId: parentNoteId,
                notePosition: notePosition,
                prefix: this.prefix,
                isExpanded: this.isExpanded
            });
        }
    }
}

module.exports = BBranch;
