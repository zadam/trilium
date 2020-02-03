import treeCache from './tree_cache.js';
import server from './server.js';
import appContext from "./app_context.js";

async function cloneNoteTo(childNoteId, parentNoteId, prefix) {
    const resp = await server.put('notes/' + childNoteId + '/clone-to/' + parentNoteId, {
        prefix: prefix
    });

    if (!resp.success) {
        alert(resp.message);
    }
}

// beware that first arg is noteId and second is branchId!
async function cloneNoteAfter(noteId, afterBranchId) {
    const resp = await server.put('notes/' + noteId + '/clone-after/' + afterBranchId);

    if (!resp.success) {
        alert(resp.message);
        return;
    }

    const afterBranch = treeCache.getBranch(afterBranchId);
}

export default {
    cloneNoteAfter,
    cloneNoteTo
};