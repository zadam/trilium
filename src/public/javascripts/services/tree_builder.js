import noteDetailService from "./note_detail.js";
import utils from "./utils.js";
import Branch from "../entities/branch.js";
import server from "./server.js";
import treeCache from "./tree_cache.js";
import messagingService from "./messaging.js";

async function prepareTree(noteRows, branchRows, relations) {
    utils.assertArguments(noteRows, branchRows, relations);

    treeCache.load(noteRows, branchRows, relations);

    return await prepareRealBranch(await treeCache.getNote('root'));
}

async function prepareBranch(note) {
    if (note.type === 'search') {
        return await prepareSearchBranch(note);
    }
    else {
        return await prepareRealBranch(note);
    }
}

async function prepareRealBranch(parentNote) {
    utils.assertArguments(parentNote);

    const childBranches = await parentNote.getChildBranches();

    if (!childBranches) {
        messagingService.logError(`No children for ${parentNote}. This shouldn't happen.`);
        return;
    }

    const noteList = [];

    for (const branch of childBranches) {
        const note = await branch.getNote();
        const title = (branch.prefix ? (branch.prefix + " - ") : "") + note.title;

        const node = {
            noteId: note.noteId,
            parentNoteId: branch.parentNoteId,
            branchId: branch.branchId,
            isProtected: note.isProtected,
            title: utils.escapeHtml(title),
            extraClasses: await getExtraClasses(note),
            refKey: note.noteId,
            expanded: note.type !== 'search' && branch.isExpanded
        };

        if (note.hasChildren() || note.type === 'search') {
            node.folder = true;

            if (node.expanded && note.type !== 'search') {
                node.children = await prepareRealBranch(note);
            }
            else {
                node.lazy = true;
            }
        }

        noteList.push(node);
    }

    return noteList;
}

async function prepareSearchBranch(note) {
    const fullNote = await noteDetailService.loadNote(note.noteId);
    const noteIds = await server.get('search/' + encodeURIComponent(fullNote.jsonContent.searchString));

    for (const noteId of noteIds) {
        const branch = new Branch(treeCache, {
            branchId: "virt" + utils.randomString(10),
            noteId: noteId,
            parentNoteId: note.noteId,
            prefix: '',
            virtual: true
        });

        treeCache.addBranch(branch);
    }

    return await prepareRealBranch(fullNote);
}

async function getExtraClasses(note) {
    utils.assertArguments(note);

    const extraClasses = [];

    if (note.isProtected) {
        extraClasses.push("protected");
    }

    if (note.getParentNoteIds().length > 1) {
        extraClasses.push("multiple-parents");
    }

    extraClasses.push(note.type);

    return extraClasses.join(" ");
}

export default {
    prepareTree,
    prepareBranch,
    getExtraClasses
}