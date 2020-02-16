import treeService from './tree.js';
import treeCache from "./tree_cache.js";
import hoistedNoteService from './hoisted_note.js';
import clipboard from './clipboard.js';
import protectedSessionHolder from "./protected_session_holder.js";
import appContext from "./app_context.js";
import noteCreateService from "./note_create.js";

class TreeContextMenu {
    /**
     * @param {NoteTreeWidget} treeWidget
     * @param {FancytreeNode} node
     */
    constructor(treeWidget, node) {
        this.treeWidget = treeWidget;
        this.node = node;
    }

    getNoteTypeItems(baseCmd) {
        return [
            { title: "Text", cmd: baseCmd + "_text", uiIcon: "note" },
            { title: "Code", cmd: baseCmd + "_code", uiIcon: "code" },
            { title: "Saved search", cmd: baseCmd + "_search", uiIcon: "file-find" },
            { title: "Relation Map", cmd: baseCmd + "_relation-map", uiIcon: "map-alt" },
            { title: "Render HTML note", cmd: baseCmd + "_render", uiIcon: "extension" },
            { title: "Book", cmd: baseCmd + "_book", uiIcon: "book" }
        ];
    }

    async getContextMenuItems() {
        const note = await treeCache.getNote(this.node.data.noteId);
        const branch = treeCache.getBranch(this.node.data.branchId);
        const parentNote = await treeCache.getNote(branch.parentNoteId);
        const isNotRoot = note.noteId !== 'root';
        const isHoisted = note.noteId === hoistedNoteService.getHoistedNoteId();

        // some actions don't support multi-note so they are disabled when notes are selected
        // the only exception is when the only selected note is the one that was right-clicked, then
        // it's clear what the user meant to do.
        const selNodes = this.treeWidget.getSelectedNodes();
        const noSelectedNotes = selNodes.length === 0
                || (selNodes.length === 1 && selNodes[0] === this.node);

        const notSearch = note.type !== 'search';
        const parentNotSearch = !parentNote || parentNote.type !== 'search';
        const insertNoteAfterEnabled = isNotRoot && !isHoisted && parentNotSearch;

        return [
            { title: 'Open in new tab', cmd: "openInTab", uiIcon: "empty", enabled: noSelectedNotes },
            { title: 'Insert note after <kbd data-kb-command="createNoteAfter"></kbd>', cmd: "insertNoteAfter", uiIcon: "plus",
                items: insertNoteAfterEnabled ? this.getNoteTypeItems("insertNoteAfter") : null,
                enabled: insertNoteAfterEnabled && noSelectedNotes },
            { title: 'Insert child note <kbd data-kb-command="createNoteInto"></kbd>', cmd: "insertChildNote", uiIcon: "plus",
                items: notSearch ? this.getNoteTypeItems("insertChildNote") : null,
                enabled: notSearch && noSelectedNotes },
            { title: 'Delete <kbd data-kb-command="deleteNotes"></kbd>', cmd: "deleteNotes", uiIcon: "trash",
                enabled: isNotRoot && !isHoisted && parentNotSearch },
            { title: "----" },
            { title: 'Search in subtree <kbd data-kb-command="searchInSubtree"></kbd>', cmd: "searchInSubtree", uiIcon: "search",
                enabled: notSearch && noSelectedNotes },
            isHoisted ? null : { title: 'Hoist note <kbd data-kb-command="toggleNoteHoisting"></kbd>', cmd: "toggleNoteHoisting", uiIcon: "empty", enabled: noSelectedNotes && notSearch },
            !isHoisted || !isNotRoot ? null : { title: 'Unhoist note <kbd data-kb-command="ToggleNoteHoisting"></kbd>', cmd: "toggleNoteHoisting", uiIcon: "arrow-up" },
            { title: 'Edit branch prefix <kbd data-kb-command="editBranchPrefix"></kbd>', cmd: "editBranchPrefix", uiIcon: "empty",
                enabled: isNotRoot && parentNotSearch && noSelectedNotes},
            { title: "Advanced", uiIcon: "empty", enabled: true, items: [
                    { title: 'Collapse subtree <kbd data-kb-command="collapseSubtree"></kbd>', cmd: "collapseSubtree", uiIcon: "align-justify", enabled: noSelectedNotes },
                    { title: "Force note sync", cmd: "forceNoteSync", uiIcon: "refresh", enabled: noSelectedNotes },
                    { title: 'Sort alphabetically <kbd data-kb-command="sortChildNotes"></kbd>', cmd: "sortChildNotes", uiIcon: "empty", enabled: noSelectedNotes && notSearch }
                ] },
            { title: "----" },
            { title: "Protect subtree", cmd: "protectSubtree", uiIcon: "check-shield", enabled: noSelectedNotes },
            { title: "Unprotect subtree", cmd: "unprotectSubtree", uiIcon: "shield", enabled: noSelectedNotes },
            { title: "----" },
            { title: 'Copy / clone <kbd data-kb-command="copyNotesToClipboard"></kbd>', cmd: "copyNotesToClipboard", uiIcon: "copy",
                enabled: isNotRoot && !isHoisted },
            { title: 'Clone to ... <kbd data-kb-command="cloneNotesTo"></kbd>', cmd: "cloneNotesTo", uiIcon: "empty",
                enabled: isNotRoot && !isHoisted },
            { title: 'Cut <kbd data-kb-command="cutNotesToClipboard"></kbd>', cmd: "cutNotesToClipboard", uiIcon: "cut",
                enabled: isNotRoot && !isHoisted && parentNotSearch },
            { title: 'Move to ... <kbd data-kb-command="moveNotesTo"></kbd>', cmd: "moveNotesTo", uiIcon: "empty",
                enabled: isNotRoot && !isHoisted && parentNotSearch },
            { title: 'Paste into <kbd data-kb-command="pasteNotesFromClipboard"></kbd>', cmd: "pasteNotesFromClipboard", uiIcon: "paste",
                enabled: !clipboard.isClipboardEmpty() && notSearch && noSelectedNotes },
            { title: 'Paste after', cmd: "pasteNotesAfterFromClipboard", uiIcon: "paste",
                enabled: !clipboard.isClipboardEmpty() && isNotRoot && !isHoisted && parentNotSearch && noSelectedNotes },
            { title: "Duplicate note here", cmd: "duplicateNote", uiIcon: "empty",
                enabled: noSelectedNotes && parentNotSearch && isNotRoot && !isHoisted && (!note.isProtected || protectedSessionHolder.isProtectedSessionAvailable()) },
            { title: "----" },
            { title: "Export", cmd: "exportNote", uiIcon: "empty",
                enabled: notSearch && noSelectedNotes },
            { title: "Import into note", cmd: "importIntoNote", uiIcon: "empty",
                enabled: notSearch && noSelectedNotes }
        ].filter(row => row !== null);
    }

    async selectContextMenuItem(event, cmd) {
        const noteId = this.node.data.noteId;
        const notePath = treeService.getNotePath(this.node);

        if (cmd === 'openInTab') {
            const tabContext = appContext.tabManager.openEmptyTab();
            appContext.tabManager.activateTab(tabContext.tabId);
            tabContext.setNote(notePath);
        }
        else if (cmd.startsWith("insertNoteAfter")) {
            const parentNoteId = this.node.data.parentNoteId;
            const isProtected = await treeService.getParentProtectedStatus(this.node);
            const type = cmd.split("_")[1];

            noteCreateService.createNote(parentNoteId, {
                target: 'after',
                targetBranchId: this.node.data.branchId,
                type: type,
                isProtected: isProtected
            });
        }
        else if (cmd.startsWith("insertChildNote")) {
            const type = cmd.split("_")[1];

            noteCreateService.createNote(noteId, {
                type: type,
                isProtected: this.node.data.isProtected
            });
        }
        else {
            this.treeWidget.triggerCommand(cmd, {node: this.node});
        }
    }
}

export default TreeContextMenu;