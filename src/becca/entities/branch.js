"use strict";

const Note = require('./note');
const AbstractEntity = require("./abstract_entity");
const sql = require("../../services/sql");
const dateUtils = require("../../services/date_utils");
const utils = require("../../services/utils.js");
const TaskContext = require("../../services/task_context");
const cls = require("../../services/cls");
const log = require("../../services/log");

/**
 * Branch represents a relationship between a child note and its parent note. Trilium allows a note to have multiple
 * parents.
 *
 * @extends AbstractEntity
 */
class Branch extends AbstractEntity {
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
        /** @type {string} */
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

        if (this.branchId === 'root') {
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

    /** @returns {Note} */
    get childNote() {
        if (!(this.noteId in this.becca.notes)) {
            // entities can come out of order in sync/import, create skeleton which will be filled later
            this.becca.addNote(this.noteId, new Note({noteId: this.noteId}));
        }

        return this.becca.notes[this.noteId];
    }

    getNote() {
        return this.childNote;
    }

    /** @returns {Note} */
    get parentNote() {
        if (!(this.parentNoteId in this.becca.notes)) {
            // entities can come out of order in sync/import, create skeleton which will be filled later
            this.becca.addNote(this.parentNoteId, new Note({noteId: this.parentNoteId}));
        }

        return this.becca.notes[this.parentNoteId];
    }

    get isDeleted() {
        return !(this.branchId in this.becca.branches);
    }

    /**
     * Delete a branch. If this is a last note's branch, delete the note as well.
     *
     * @param {string} [deleteId] - optional delete identified
     * @param {TaskContext} [taskContext]
     *
     * @return {boolean} - true if note has been deleted, false otherwise
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

        if (this.branchId === 'root'
            || this.noteId === 'root'
            || this.noteId === cls.getHoistedNoteId()) {

            throw new Error("Can't delete root or hoisted branch/note");
        }

        this.markAsDeleted(deleteId);

        const notDeletedBranches = note.getParentBranches();

        if (notDeletedBranches.length === 0) {
            for (const childBranch of note.getChildBranches()) {
                childBranch.deleteBranch(deleteId, taskContext);
            }

            // first delete children and then parent - this will show up better in recent changes

            log.info("Deleting note " + note.noteId);

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
        if (this.notePosition === undefined || this.notePosition === null) {
            // TODO finding new position can be refactored into becca
            const maxNotePos = sql.getValue('SELECT MAX(notePosition) FROM branches WHERE parentNoteId = ? AND isDeleted = 0', [this.parentNoteId]);
            this.notePosition = maxNotePos === null ? 0 : maxNotePos + 10;
        }

        if (!this.isExpanded) {
            this.isExpanded = false;
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
        return new Branch({
            noteId: this.noteId,
            parentNoteId: parentNoteId,
            notePosition: notePosition,
            prefix: this.prefix,
            isExpanded: this.isExpanded
        });
    }
}

module.exports = Branch;
