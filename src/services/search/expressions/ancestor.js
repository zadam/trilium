import Expression from './expression.js'
import NoteSet from '../note_set.js'
import log from '../../log.js'
import becca from '../../../becca/becca.js'

class AncestorExp extends Expression {
    constructor(ancestorNoteId, ancestorDepth) {
        super();

        this.ancestorNoteId = ancestorNoteId;
        this.ancestorDepth = ancestorDepth; // for DEBUG mode
        this.ancestorDepthComparator = this.getComparator(ancestorDepth);
    }

    execute(inputNoteSet, executionContext, searchContext) {
        const ancestorNote = becca.notes[this.ancestorNoteId];

        if (!ancestorNote) {
            log.error(`Subtree note '${this.ancestorNoteId}' was not not found.`);

            return new NoteSet([]);
        }

        const subtree = ancestorNote.getSubtree();

        const subTreeNoteSet = new NoteSet(subtree.notes).intersection(inputNoteSet);

        if (!this.ancestorDepthComparator) {
            return subTreeNoteSet;
        }

        const depthConformingNoteSet = new NoteSet([]);

        for (const note of subTreeNoteSet.notes) {
            const distance = note.getDistanceToAncestor(ancestorNote.noteId);

            if (this.ancestorDepthComparator(distance)) {
                depthConformingNoteSet.add(note);
            }
        }

        return depthConformingNoteSet;
    }

    getComparator(depthCondition) {
        if (!depthCondition) {
            return null;
        }

        const comparedDepth = parseInt(depthCondition.substr(2));

        if (depthCondition.startsWith("eq")) {
            return depth => depth === comparedDepth;
        }
        else if (depthCondition.startsWith("gt")) {
            return depth => depth > comparedDepth;
        }
        else if (depthCondition.startsWith("lt")) {
            return depth => depth < comparedDepth;
        }
        else {
            log.error(`Unrecognized depth condition value ${depthCondition}`);
            return null;
        }
    }
}

export default AncestorExp;
