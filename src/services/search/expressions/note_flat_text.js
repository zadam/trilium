"use strict";

const Expression = require('./expression');
const NoteSet = require('../note_set');
const becca = require('../../../becca/becca');
const utils = require("../../utils");

class NoteFlatTextExp extends Expression {
    constructor(tokens) {
        super();

        this.tokens = tokens;
    }

    execute(inputNoteSet, executionContext, searchContext) {
        // has deps on SQL which breaks unit test so needs to be dynamically required
        const beccaService = require('../../../becca/becca_service');
        const resultNoteSet = new NoteSet();

        /**
         * @param {BNote} note
         * @param {string[]} tokens
         * @param {string[]} path
         */
        const searchDownThePath = (note, tokens, path) => {
            if (tokens.length === 0) {
                const retPath = this.getNotePath(note, path);

                if (retPath) {
                    const noteId = retPath[retPath.length - 1];

                    if (!resultNoteSet.hasNoteId(noteId)) {
                        // we could get here from multiple paths, the first one wins because the paths
                        // are sorted by importance
                        executionContext.noteIdToNotePath[noteId] = retPath;

                        resultNoteSet.add(becca.notes[noteId]);
                    }
                }

                return;
            }

            if (note.parents.length === 0 || note.noteId === 'root') {
                return;
            }

            const foundAttrTokens = [];

            for (const token of tokens) {
                if (note.type.includes(token) || note.mime.includes(token)) {
                    foundAttrTokens.push(token);
                }
            }

            for (const attribute of note.ownedAttributes) {
                const normalizedName = utils.normalize(attribute.name);
                const normalizedValue = utils.normalize(attribute.value);

                for (const token of tokens) {
                    if (normalizedName.includes(token) || normalizedValue.includes(token)) {
                        foundAttrTokens.push(token);
                    }
                }
            }

            for (const parentNote of note.parents) {
                const title = utils.normalize(beccaService.getNoteTitle(note.noteId, parentNote.noteId));
                const foundTokens = foundAttrTokens.slice();

                for (const token of tokens) {
                    if (title.includes(token)) {
                        foundTokens.push(token);
                    }
                }

                if (foundTokens.length > 0) {
                    const remainingTokens = tokens.filter(token => !foundTokens.includes(token));

                    searchDownThePath(parentNote, remainingTokens, [...path, note.noteId]);
                }
                else {
                    searchDownThePath(parentNote, tokens, [...path, note.noteId]);
                }
            }
        }

        const candidateNotes = this.getCandidateNotes(inputNoteSet);

        for (const note of candidateNotes) {
            // autocomplete should be able to find notes by their noteIds as well (only leafs)
            if (this.tokens.length === 1 && note.noteId.toLowerCase() === this.tokens[0]) {
                searchDownThePath(note, [], []);
                continue;
            }

            const foundAttrTokens = [];

            for (const token of this.tokens) {
                if (note.type.includes(token) || note.mime.includes(token)) {
                    foundAttrTokens.push(token);
                }

                for (const attribute of note.ownedAttributes) {
                    if (utils.normalize(attribute.name).includes(token)
                        || utils.normalize(attribute.value).includes(token)) {

                        foundAttrTokens.push(token);
                    }
                }
            }

            for (const parentNote of note.parents) {
                const title = utils.normalize(beccaService.getNoteTitle(note.noteId, parentNote.noteId));
                const foundTokens = foundAttrTokens.slice();

                for (const token of this.tokens) {
                    if (title.includes(token)) {
                        foundTokens.push(token);
                    }
                }

                if (foundTokens.length > 0) {
                    const remainingTokens = this.tokens.filter(token => !foundTokens.includes(token));

                    searchDownThePath(parentNote, remainingTokens, [note.noteId]);
                }
            }
        }

        return resultNoteSet;
    }

    getNotePath(note, path) {
        if (path.length === 0) {
            return note.getBestNotePath();
        } else {
            const closestNoteId = path[0];
            const closestNoteBestNotePath = becca.getNote(closestNoteId).getBestNotePath();

            return [...closestNoteBestNotePath, ...path.slice(1)];
        }
    }

    /**
     * Returns noteIds which have at least one matching tokens
     *
     * @param {NoteSet} noteSet
     * @returns {BNote[]}
     */
    getCandidateNotes(noteSet) {
        const candidateNotes = [];

        for (const note of noteSet.notes) {
            for (const token of this.tokens) {
                if (note.getFlatText().includes(token)) {
                    candidateNotes.push(note);
                    break;
                }
            }
        }

        return candidateNotes;
    }
}

module.exports = NoteFlatTextExp;
