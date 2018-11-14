import noteDetailService from "./note_detail.js";
import utils from "./utils.js";
import Branch from "../entities/branch.js";
import server from "./server.js";
import treeCache from "./tree_cache.js";
import messagingService from "./messaging.js";

async function prepareTree(noteRows, branchRows, relations) {
    utils.assertArguments(noteRows, branchRows, relations);

    treeCache.load(noteRows, branchRows, relations);

    return [ await prepareNode(await treeCache.getBranch('root')) ];
}

async function prepareBranch(note) {
    if (note.type === 'search') {
        return await prepareSearchBranch(note);
    }
    else {
        return await prepareRealBranch(note);
    }
}

function getIcon(note) {
    if (note.noteId === 'root') {
        return "jam jam-chevrons-right";
    }
    else if (note.type === 'text') {
        if (note.hasChildren()) {
            return "jam jam-folder";
        }
        else {
            return "jam jam-file";
        }
    }
    else if (note.type === 'file') {
        return "jam jam-attachment"
    }
    else if (note.type === 'image') {
        return "jam jam-picture"
    }
    else if (note.type === 'code') {
        return "jam jam-terminal"
    }
    else if (note.type === 'render') {
        return "jam jam-play"
    }
    else if (note.type === 'search') {
        return "jam jam-search-folder"
    }
    else if (note.type === 'relation-map') {
        return "jam jam-map"
    }
}

async function prepareNode(branch) {
    const note = await branch.getNote();
    const title = (branch.prefix ? (branch.prefix + " - ") : "") + note.title;

    const node = {
        noteId: note.noteId,
        parentNoteId: branch.parentNoteId,
        branchId: branch.branchId,
        isProtected: note.isProtected,
        title: utils.escapeHtml(title),
        extraClasses: await getExtraClasses(note),
        icon: getIcon(note),
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

    return node;
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
        const node = await prepareNode(branch);

        noteList.push(node);
    }

    return noteList;
}

async function prepareSearchBranch(note) {
    const fullNote = await noteDetailService.loadNote(note.noteId);
    const results = (await server.get('search/' + encodeURIComponent(fullNote.jsonContent.searchString)))
        .filter(res => res.noteId !== note.noteId); // this is necessary because title of the search note is often the same as the search text which would match and create circle

    // force to load all the notes at once instead of one by one
    await treeCache.getNotes(results.map(res => res.noteId));

    for (const result of results) {
        const origBranch = await treeCache.getBranch(result.branchId);

        const branch = new Branch(treeCache, {
            branchId: "virt" + utils.randomString(10),
            noteId: result.noteId,
            parentNoteId: note.noteId,
            prefix: origBranch.prefix,
            virtual: true
        });

        treeCache.addBranch(branch);
    }

    return await prepareRealBranch(fullNote);
}

async function getExtraClasses(note) {
    utils.assertArguments(note);

    const extraClasses = [];

    if (note.noteId === 'root') {
        extraClasses.push("tree-root");
    }

    if (note.isProtected) {
        extraClasses.push("protected");
    }

    if (note.getParentNoteIds().length > 1) {
        extraClasses.push("multiple-parents");
    }

    if (note.cssClass) {
        extraClasses.push(note.cssClass);
    }

    extraClasses.push(note.type);

    return extraClasses.join(" ");
}

export default {
    prepareTree,
    prepareBranch,
    getExtraClasses,
    getIcon
}