import server from './server.js';
import froca from './froca.js';

async function addLabel(noteId, name, value = "") {
    await server.put(`notes/${noteId}/attribute`, {
        type: 'label',
        name: name,
        value: value
    });
}

async function setLabel(noteId, name, value = "") {
    await server.put(`notes/${noteId}/set-attribute`, {
        type: 'label',
        name: name,
        value: value
    });
}

async function removeAttributeById(noteId, attributeId) {
    await server.remove(`notes/${noteId}/attributes/${attributeId}`);
}

/**
 * @return {boolean} - returns true if this attribute has the potential to influence the note in the argument.
 *         That can happen in multiple ways:
 *         1. attribute is owned by the note
 *         2. attribute is owned by the template of the note
 *         3. attribute is owned by some note's ancestor and is inheritable
 */
function isAffecting(attrRow, affectedNote) {
    if (!affectedNote || !attrRow) {
        return false;
    }

    const attrNote = froca.notes[attrRow.noteId];

    if (!attrNote) {
        // the note (owner of the attribute) is not even loaded into the cache so it should not affect anything else
        return false;
    }

    const owningNotes = [affectedNote, ...affectedNote.getTemplateNotes()];

    for (const owningNote of owningNotes) {
        if (owningNote.noteId === attrNote.noteId) {
            return true;
        }
    }

    if (this.isInheritable) {
        for (const owningNote of owningNotes) {
            if (owningNote.hasAncestor(attrNote.noteId)) {
                return true;
            }
        }
    }

    return false;
}

export default {
    addLabel,
    setLabel,
    removeAttributeById,
    isAffecting
}
