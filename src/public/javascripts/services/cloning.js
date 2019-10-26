import treeService from './tree.js';
import treeCache from './tree_cache.js';
import server from './server.js';

async function cloneNoteTo(childNoteId, parentNoteId, prefix) {
    const resp = await server.put('notes/' + childNoteId + '/clone-to/' + parentNoteId, {
        prefix: prefix
    });

    if (!resp.success) {
        alert(resp.message);
        return;
    }

    await treeService.reloadNotes([childNoteId, parentNoteId]);
}

// beware that first arg is noteId and second is branchId!
async function cloneNoteAfter(noteId, afterBranchId) {
    const resp = await server.put('notes/' + noteId + '/clone-after/' + afterBranchId);

    if (!resp.success) {
        alert(resp.message);
        return;
    }

    const afterBranch = treeCache.getBranch(afterBranchId);

    await treeService.reloadNotes([noteId, afterBranch.parentNoteId]);
}

export default {
    cloneNoteAfter,
    cloneNoteTo
};