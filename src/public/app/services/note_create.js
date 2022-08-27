import appContext from "./app_context.js";
import utils from "./utils.js";
import protectedSessionHolder from "./protected_session_holder.js";
import server from "./server.js";
import ws from "./ws.js";
import froca from "./froca.js";
import treeService from "./tree.js";
import toastService from "./toast.js";

async function createNote(parentNotePath, options = {}) {
    options = Object.assign({
        activate: true,
        focus: 'title',
        target: 'into'
    }, options);

    // if isProtected isn't available (user didn't enter password yet), then note is created as unencrypted
    // but this is quite weird since user doesn't see WHERE the note is being created so it shouldn't occur often
    if (!options.isProtected || !protectedSessionHolder.isProtectedSessionAvailable()) {
        options.isProtected = false;
    }

    if (appContext.tabManager.getActiveContextNoteType() !== 'text') {
        options.saveSelection = false;
    }

    if (options.saveSelection) {
        [options.title, options.content] = parseSelectedHtml(options.textEditor.getSelectedHtml());
    }

    const parentNoteId = treeService.getNoteIdFromNotePath(parentNotePath);

    if (options.type === 'mermaid' && !options.content) {
        options.content = `graph TD;
    A-->B;
    A-->C;
    B-->D;
    C-->D;`
    }

    const {note, branch} = await server.post(`notes/${parentNoteId}/children?target=${options.target}&targetBranchId=${options.targetBranchId || ""}`, {
        title: options.title,
        content: options.content || "",
        isProtected: options.isProtected,
        type: options.type,
        mime: options.mime,
        templateNoteId: options.templateNoteId
    });

    if (options.saveSelection) {
        // we remove the selection only after it was saved to server to make sure we don't lose anything
        options.textEditor.removeSelection();
    }

    await ws.waitForMaxKnownEntityChangeId();

    if (options.activate) {
        const activeNoteContext = appContext.tabManager.getActiveContext();
        await activeNoteContext.setNote(`${parentNotePath}/${note.noteId}`);

        if (options.focus === 'title') {
            appContext.triggerEvent('focusAndSelectTitle', {isNewNote: true});
        }
        else if (options.focus === 'content') {
            appContext.triggerEvent('focusOnDetail', {ntxId: activeNoteContext.ntxId});
        }
    }

    const noteEntity = await froca.getNote(note.noteId);
    const branchEntity = froca.getBranch(branch.branchId);

    return {
        note: noteEntity,
        branch: branchEntity
    };
}

async function chooseNoteType() {
    return new Promise(res => {
        appContext.triggerCommand("chooseNoteType", {callback: res});
    });
}

async function createNoteWithTypePrompt(parentNotePath, options = {}) {
    const {success, noteType, templateNoteId} = await chooseNoteType();

    if (!success) {
        return;
    }

    options.type = noteType;
    options.templateNoteId = templateNoteId;

    return await createNote(parentNotePath, options);
}

/* If first element is heading, parse it out and use it as a new heading. */
function parseSelectedHtml(selectedHtml) {
    const dom = $.parseHTML(selectedHtml);

    if (dom.length > 0 && dom[0].tagName && dom[0].tagName.match(/h[1-6]/i)) {
        const title = $(dom[0]).text();
        // remove the title from content (only first occurence)
        const content = selectedHtml.replace(dom[0].outerHTML, "");

        return [title, content];
    }
    else {
        return [null, selectedHtml];
    }
}

async function duplicateSubtree(noteId, parentNotePath) {
    const parentNoteId = treeService.getNoteIdFromNotePath(parentNotePath);
    const {note} = await server.post(`notes/${noteId}/duplicate/${parentNoteId}`);

    await ws.waitForMaxKnownEntityChangeId();

    const activeNoteContext = appContext.tabManager.getActiveContext();
    activeNoteContext.setNote(`${parentNotePath}/${note.noteId}`);

    const origNote = await froca.getNote(noteId);
    toastService.showMessage(`Note "${origNote.title}" has been duplicated`);
}

export default {
    createNote,
    createNoteWithTypePrompt,
    duplicateSubtree,
    chooseNoteType
};
