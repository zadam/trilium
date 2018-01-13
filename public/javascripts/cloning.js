"use strict";

const cloning = (function() {
    async function cloneNoteTo(childNoteId, parentNoteId, prefix) {
        const resp = await server.put('notes/' + childNoteId + '/clone-to/' + parentNoteId, {
            prefix: prefix
        });

        if (!resp.success) {
            alert(resp.message);
            return;
        }

        await noteTree.reload();
    }

    // beware that first arg is noteId and second is noteTreeId!
    async function cloneNoteAfter(noteId, afterNoteTreeId) {
        const resp = await server.put('notes/' + noteId + '/clone-after/' + afterNoteTreeId);

        if (!resp.success) {
            alert(resp.message);
            return;
        }

        await noteTree.reload();
    }

    return {
        cloneNoteAfter,
        cloneNoteTo
    };
})();