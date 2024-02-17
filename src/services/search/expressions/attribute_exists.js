"use strict";

const NoteSet = require('../note_set');
const becca = require('../../../becca/becca');
const Expression = require('./expression');

class AttributeExistsExp extends Expression {
    constructor(attributeType, attributeName, prefixMatch) {
        super();

        this.attributeType = attributeType;
        this.attributeName = attributeName;
        // template attr is used as a marker for templates, but it's not meant to be inherited
        this.isTemplateLabel = this.attributeType === 'label' && (this.attributeName === 'template' || this.attributeName === 'workspacetemplate');
        this.prefixMatch = prefixMatch;
    }

    execute(inputNoteSet, executionContext, searchContext) {
        const attrs = this.prefixMatch
            ? becca.findAttributesWithPrefix(this.attributeType, this.attributeName)
            : becca.findAttributes(this.attributeType, this.attributeName);

        const resultNoteSet = new NoteSet();

        for (const attr of attrs) {
            const note = attr.note;

            if (attr.isInheritable && !this.isTemplateLabel) {
                resultNoteSet.addAll(note.getSubtreeNotesIncludingTemplated());
            }
            else if (note.isInherited() && !this.isTemplateLabel) {
                resultNoteSet.addAll(note.getInheritingNotes());
            }
            else {
                resultNoteSet.add(note);
            }
        }

        return resultNoteSet.intersection(inputNoteSet);
    }
}

module.exports = AttributeExistsExp;
