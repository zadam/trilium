import Expression from './expression.js'
import NoteSet from '../note_set.js'
import becca from '../../../becca/becca.js'

class RelationWhereExp extends Expression {
    constructor(relationName, subExpression) {
        super();

        this.relationName = relationName;
        this.subExpression = subExpression;
    }

    execute(inputNoteSet, executionContext, searchContext) {
        const candidateNoteSet = new NoteSet();

        for (const attr of becca.findAttributes('relation', this.relationName)) {
            const note = attr.note;

            if (inputNoteSet.hasNoteId(note.noteId) && attr.targetNote) {
                const subInputNoteSet = new NoteSet([attr.targetNote]);
                const subResNoteSet = this.subExpression.execute(subInputNoteSet, executionContext, searchContext);

                if (subResNoteSet.hasNote(attr.targetNote)) {
                    if (attr.isInheritable) {
                        candidateNoteSet.addAll(note.getSubtreeNotesIncludingTemplated());
                    } else if (note.isInherited()) {
                        candidateNoteSet.addAll(note.getInheritingNotes());
                    } else {
                        candidateNoteSet.add(note);
                    }
                }
            }
        }

        return candidateNoteSet.intersection(inputNoteSet);
    }
}

export default RelationWhereExp;
