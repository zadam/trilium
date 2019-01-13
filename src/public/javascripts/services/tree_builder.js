import noteDetailService from "./note_detail.js";
import utils from "./utils.js";
import Branch from "../entities/branch.js";
import server from "./server.js";
import treeCache from "./tree_cache.js";
import messagingService from "./messaging.js";
import hoistedNoteService from "./hoisted_note.js";

async function prepareTree(noteRows, branchRows, relations) {
    utils.assertArguments(noteRows, branchRows, relations);

    treeCache.load(noteRows, branchRows, relations);

    const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();

    let hoistedBranch;

    if (hoistedNoteId === 'root') {
        hoistedBranch = await treeCache.getBranch('root');
    }
    else {
        const hoistedNote = await treeCache.getNote(hoistedNoteId);
        hoistedBranch = (await hoistedNote.getBranches())[0];
    }

    return [ await prepareNode(hoistedBranch) ];
}

async function prepareBranch(note) {
    if (note.type === 'search') {
        return await prepareSearchBranch(note);
    }
    else {
        return await prepareRealBranch(note);
    }
}

async function getIcon(note) {
    const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();

    if (note.noteId === 'root') {
        return "jam jam-chevrons-right";
    }
    else if (note.noteId === hoistedNoteId) {
        return "jam jam-arrow-up";
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
    const hoistedNoteId = await hoistedNoteService.getHoistedNoteId();

    const node = {
        noteId: note.noteId,
        parentNoteId: branch.parentNoteId,
        branchId: branch.branchId,
        isProtected: note.isProtected,
        title: utils.escapeHtml(title),
        extraClasses: await getExtraClasses(note),
        icon: await getIcon(note),
        refKey: note.noteId,
        expanded: branch.isExpanded || hoistedNoteId === note.noteId
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

    if (note.mime) { // some notes should not have mime type (e.g. render)
        extraClasses.push(getMimeTypeClass(note.mime));
    }

    return extraClasses.join(" ");
}

function getMimeTypeClass(mime) {
    const semicolonIdx = mime.indexOf(';');

    if (semicolonIdx !== -1) {
        // stripping everything following the semicolon
        mime = mime.substr(0, semicolonIdx);
    }

    return 'mime-' + mime.toLowerCase().replace(/[\W_]+/g,"-");
}

export default {
    prepareTree,
    prepareBranch,
    getExtraClasses,
    getIcon
}