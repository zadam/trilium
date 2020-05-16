export default class NoteCacheFulltextExp {
    constructor(tokens) {
        this.tokens = tokens;
    }

    execute(noteSet, searchContext) {
        const resultNoteSet = new NoteSet();

        const candidateNotes = this.getCandidateNotes(noteSet);

        for (const note of candidateNotes) {
            // autocomplete should be able to find notes by their noteIds as well (only leafs)
            if (this.tokens.length === 1 && note.noteId === this.tokens[0]) {
                this.searchDownThePath(note, [], [], resultNoteSet, searchContext);
                continue;
            }

            // for leaf note it doesn't matter if "archived" label is inheritable or not
            if (note.isArchived) {
                continue;
            }

            const foundAttrTokens = [];

            for (const attribute of note.ownedAttributes) {
                for (const token of this.tokens) {
                    if (attribute.name.toLowerCase().includes(token)
                        || attribute.value.toLowerCase().includes(token)) {
                        foundAttrTokens.push(token);
                    }
                }
            }

            for (const parentNote of note.parents) {
                const title = getNoteTitle(note.noteId, parentNote.noteId).toLowerCase();
                const foundTokens = foundAttrTokens.slice();

                for (const token of this.tokens) {
                    if (title.includes(token)) {
                        foundTokens.push(token);
                    }
                }

                if (foundTokens.length > 0) {
                    const remainingTokens = this.tokens.filter(token => !foundTokens.includes(token));

                    this.searchDownThePath(parentNote, remainingTokens, [note.noteId], resultNoteSet, searchContext);
                }
            }
        }

        return resultNoteSet;
    }

    /**
     * Returns noteIds which have at least one matching tokens
     *
     * @param {NoteSet} noteSet
     * @return {String[]}
     */
    getCandidateNotes(noteSet) {
        const candidateNotes = [];

        for (const note of noteSet.notes) {
            for (const token of this.tokens) {
                if (note.flatText.includes(token)) {
                    candidateNotes.push(note);
                    break;
                }
            }
        }

        return candidateNotes;
    }

    searchDownThePath(note, tokens, path, resultNoteSet, searchContext) {
        if (tokens.length === 0) {
            const retPath = getSomePath(note, path);

            if (retPath) {
                const noteId = retPath[retPath.length - 1];
                searchContext.noteIdToNotePath[noteId] = retPath;

                resultNoteSet.add(notes[noteId]);
            }

            return;
        }

        if (!note.parents.length === 0 || note.noteId === 'root') {
            return;
        }

        const foundAttrTokens = [];

        for (const attribute of note.ownedAttributes) {
            for (const token of tokens) {
                if (attribute.name.toLowerCase().includes(token)
                    || attribute.value.toLowerCase().includes(token)) {
                    foundAttrTokens.push(token);
                }
            }
        }

        for (const parentNote of note.parents) {
            const title = getNoteTitle(note.noteId, parentNote.noteId).toLowerCase();
            const foundTokens = foundAttrTokens.slice();

            for (const token of tokens) {
                if (title.includes(token)) {
                    foundTokens.push(token);
                }
            }

            if (foundTokens.length > 0) {
                const remainingTokens = tokens.filter(token => !foundTokens.includes(token));

                this.searchDownThePath(parentNote, remainingTokens, path.concat([note.noteId]), resultNoteSet, searchContext);
            }
            else {
                this.searchDownThePath(parentNote, tokens, path.concat([note.noteId]), resultNoteSet, searchContext);
            }
        }
    }
}
