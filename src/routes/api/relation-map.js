const becca = require('../../becca/becca.js');
const sql = require('../../services/sql.js');

function getRelationMap(req) {
    const {relationMapNoteId, noteIds} = req.body;

    const resp = {
        // noteId => title
        noteTitles: {},
        relations: [],
        // relation name => inverse relation name
        inverseRelations: {
            'internalLink': 'internalLink'
        }
    };

    if (noteIds.length === 0) {
        return resp;
    }

    const questionMarks = noteIds.map(noteId => '?').join(',');

    const relationMapNote = becca.getNote(relationMapNoteId);

    const displayRelationsVal = relationMapNote.getLabelValue('displayRelations');
    const displayRelations = !displayRelationsVal ? [] : displayRelationsVal
        .split(",")
        .map(token => token.trim());

    const hideRelationsVal = relationMapNote.getLabelValue('hideRelations');
    const hideRelations = !hideRelationsVal ? [] : hideRelationsVal
        .split(",")
        .map(token => token.trim());

    const foundNoteIds = sql.getColumn(`SELECT noteId FROM notes WHERE isDeleted = 0 AND noteId IN (${questionMarks})`, noteIds);
    const notes = becca.getNotes(foundNoteIds);

    for (const note of notes) {
        resp.noteTitles[note.noteId] = note.title;

        resp.relations = resp.relations.concat(note.getRelations()
            .filter(relation => !relation.isAutoLink() || displayRelations.includes(relation.name))
            .filter(relation => displayRelations.length > 0
                ? displayRelations.includes(relation.name)
                : !hideRelations.includes(relation.name))
            .filter(relation => noteIds.includes(relation.value))
            .map(relation => ({
                attributeId: relation.attributeId,
                sourceNoteId: relation.noteId,
                targetNoteId: relation.value,
                name: relation.name
            })));

        for (const relationDefinition of note.getRelationDefinitions()) {
            const def = relationDefinition.getDefinition();

            if (def.inverseRelation) {
                resp.inverseRelations[relationDefinition.getDefinedName()] = def.inverseRelation;
                resp.inverseRelations[def.inverseRelation] = relationDefinition.getDefinedName();
            }
        }
    }

    return resp;
}

module.exports = {
    getRelationMap
};
