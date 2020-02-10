import utils from "./utils.js";
import treeCache from "./tree_cache.js";
import ws from "./ws.js";
import hoistedNoteService from "./hoisted_note.js";

async function prepareTree() {
    await treeCache.initializedPromise;

    const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

    let hoistedBranch;

    if (hoistedNoteId === 'root') {
        hoistedBranch = treeCache.getBranch('root');
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

const NOTE_TYPE_ICONS = {
    "file": "bx bx-file",
    "image": "bx bx-image",
    "code": "bx bx-code",
    "render": "bx bx-extension",
    "search": "bx bx-file-find",
    "relation-map": "bx bx-map-alt",
    "book": "bx bx-book"
};

async function getIconClass(note) {
    const labels = await note.getLabels('iconClass');

    return labels.map(l => l.value).join(' ');
}

async function getIcon(note) {
    const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

    const iconClass = await getIconClass(note);

    if (iconClass) {
        return iconClass;
    }
    else if (note.noteId === 'root') {
        return "bx bx-chevrons-right";
    }
    else if (note.noteId === hoistedNoteId) {
        return "bx bxs-arrow-from-bottom";
    }
    else if (note.type === 'text') {
        if (note.hasChildren()) {
            return "bx bx-folder";
        }
        else {
            return "bx bx-note";
        }
    }
    else {
        return NOTE_TYPE_ICONS[note.type];
    }
}

async function prepareNode(branch) {
    const note = await branch.getNote();

    if (!note) {
        throw new Error(`Branch has no note ` + branch.noteId);
    }

    const title = (branch.prefix ? (branch.prefix + " - ") : "") + note.title;
    const hoistedNoteId = hoistedNoteService.getHoistedNoteId();

    const node = {
        noteId: note.noteId,
        parentNoteId: branch.parentNoteId,
        branchId: branch.branchId,
        isProtected: note.isProtected,
        noteType: note.type,
        title: utils.escapeHtml(title),
        extraClasses: await getExtraClasses(note),
        icon: await getIcon(note),
        refKey: note.noteId,
        expanded: branch.isExpanded || hoistedNoteId === note.noteId,
        lazy: true,
        key: utils.randomString(12) // this should prevent some "duplicate key" errors
    };

    if (note.hasChildren() || note.type === 'search') {
        node.folder = true;
    }

    return node;
}

async function prepareRealBranch(parentNote) {
    utils.assertArguments(parentNote);

    const childBranches = await parentNote.getChildBranches();

    if (!childBranches) {
        ws.logError(`No children for ${parentNote}. This shouldn't happen.`);
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
    await treeCache.reloadNotes([note.noteId]);

    const newNote = await treeCache.getNote(note.noteId);

    return await prepareRealBranch(newNote);
}

async function getCssClass(note) {
    const labels = await note.getLabels('cssClass');
    return labels.map(l => l.value).join(' ');
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

    const cssClass = await getCssClass(note);

    if (cssClass) {
        extraClasses.push(cssClass);
    }

    extraClasses.push(utils.getNoteTypeClass(note.type));

    if (note.mime) { // some notes should not have mime type (e.g. render)
        extraClasses.push(utils.getMimeTypeClass(note.mime));
    }

    if (await note.hasLabel('archived')) {
        extraClasses.push("archived");
    }

    return extraClasses.join(" ");
}

export default {
    prepareTree,
    prepareBranch,
    getExtraClasses,
    getIcon
}