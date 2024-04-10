"use strict";

import Expression = require('./expression');
import NoteSet = require('../note_set');
import log = require('../../log');
import becca = require('../../../becca/becca');
import SearchContext = require('../search_context');

class AncestorExp extends Expression {

    private ancestorNoteId: string;
    private ancestorDepthComparator;
    
    ancestorDepth?: string;

    constructor(ancestorNoteId: string, ancestorDepth?: string) {
        super();

        this.ancestorNoteId = ancestorNoteId;
        this.ancestorDepth = ancestorDepth; // for DEBUG mode
        this.ancestorDepthComparator = this.getComparator(ancestorDepth);
    }

    execute(inputNoteSet: NoteSet, executionContext: {}, searchContext: SearchContext) {
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

    getComparator(depthCondition?: string): ((depth: number) => boolean) | null {
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

export = AncestorExp;
