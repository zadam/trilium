import treeService from './tree.js';
import ws from './ws.js';
import protectedSessionService from './protected_session.js';
import treeChangesService from './branches.js';
import treeUtils from './tree_utils.js';
import treeCache from "./tree_cache.js";
import syncService from "./sync.js";
import hoistedNoteService from './hoisted_note.js';
import noteDetailService from './note_detail.js';
import clipboard from './clipboard.js';
import protectedSessionHolder from "./protected_session_holder.js";
import searchNotesService from "./search_notes.js";

class TreeContextMenu {
    constructor(node) {
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
        const isHoisted = note.noteId === await hoistedNoteService.getHoistedNoteId();

        // some actions don't support multi-note so they are disabled when notes are selected
        // the only exception is when the only selected note is the one that was right-clicked, then
        // it's clear what the user meant to do.
        const selNodes = treeService.getSelectedNodes();
        const noSelectedNotes = selNodes.length === 0
                || (selNodes.length === 1 && selNodes[0] === this.node);

        const notSearch = note.type !== 'search';
        const parentNotSearch = !parentNote || parentNote.type !== 'search';
        const insertNoteAfterEnabled = isNotRoot && !isHoisted && parentNotSearch;

        return [
            { title: 'Open in new tab', cmd: "openInTab", uiIcon: "empty", enabled: noSelectedNotes },
            { title: 'Insert note after <kbd data-kb-action="CreateNoteAfter"></kbd>', cmd: "insertNoteAfter", uiIcon: "plus",
                items: insertNoteAfterEnabled ? this.getNoteTypeItems("insertNoteAfter") : null,
                enabled: insertNoteAfterEnabled && noSelectedNotes },
            { title: 'Insert child note <kbd data-kb-action="CreateNoteInto"></kbd>', cmd: "insertChildNote", uiIcon: "plus",
                items: notSearch ? this.getNoteTypeItems("insertChildNote") : null,
                enabled: notSearch && noSelectedNotes },
            { title: 'Delete <kbd data-kb-action="DeleteNotes"></kbd>', cmd: "delete", uiIcon: "trash",
                enabled: isNotRoot && !isHoisted && parentNotSearch },
            { title: "----" },
            { title: 'Search in subtree <kbd data-kb-action="SearchInSubtree"></kbd>', cmd: "searchInSubtree", uiIcon: "search",
                enabled: notSearch && noSelectedNotes },
            isHoisted ? null : { title: 'Hoist note <kbd data-kb-action="ToggleNoteHoisting"></kbd>', cmd: "hoist", uiIcon: "empty", enabled: noSelectedNotes && notSearch },
            !isHoisted || !isNotRoot ? null : { title: 'Unhoist note <kbd data-kb-action="ToggleNoteHoisting"></kbd>', cmd: "unhoist", uiIcon: "arrow-up" },
            { title: 'Edit branch prefix <kbd data-kb-action="EditBranchPrefix"></kbd>', cmd: "editBranchPrefix", uiIcon: "empty",
                enabled: isNotRoot && parentNotSearch && noSelectedNotes},
            { title: "Advanced", uiIcon: "empty", enabled: true, items: [
                    { title: 'Collapse subtree <kbd data-kb-action="CollapseSubtree"></kbd>', cmd: "collapseSubtree", uiIcon: "align-justify", enabled: noSelectedNotes },
                    { title: "Force note sync", cmd: "forceNoteSync", uiIcon: "recycle", enabled: noSelectedNotes },
                    { title: 'Sort alphabetically <kbd data-kb-action="SortChildNotes"></kbd>', cmd: "sortAlphabetically", uiIcon: "empty", enabled: noSelectedNotes && notSearch }
                ] },
            { title: "----" },
            { title: "Protect subtree", cmd: "protectSubtree", uiIcon: "check-shield", enabled: noSelectedNotes },
            { title: "Unprotect subtree", cmd: "unprotectSubtree", uiIcon: "shield", enabled: noSelectedNotes },
            { title: "----" },
            { title: 'Copy / clone <kbd data-kb-action="CopyNotesToClipboard"></kbd>', cmd: "copy", uiIcon: "copy",
                enabled: isNotRoot && !isHoisted },
            { title: 'Clone to ... <kbd data-kb-action="CloneNotesTo"></kbd>', cmd: "cloneTo", uiIcon: "empty",
                enabled: isNotRoot && !isHoisted },
            { title: 'Cut <kbd data-kb-action="CutNotesToClipboard"></kbd>', cmd: "cut", uiIcon: "cut",
                enabled: isNotRoot && !isHoisted && parentNotSearch },
            { title: 'Move to ... <kbd data-kb-action="MoveNotesTo"></kbd>', cmd: "moveTo", uiIcon: "empty",
                enabled: isNotRoot && !isHoisted && parentNotSearch },
            { title: 'Paste into <kbd data-kb-action="PasteNotesFromClipboard"></kbd>', cmd: "pasteInto", uiIcon: "paste",
                enabled: !clipboard.isClipboardEmpty() && notSearch && noSelectedNotes },
            { title: 'Paste after', cmd: "pasteAfter", uiIcon: "paste",
                enabled: !clipboard.isClipboardEmpty() && isNotRoot && !isHoisted && parentNotSearch && noSelectedNotes },
            { title: "Duplicate note here", cmd: "duplicateNote", uiIcon: "empty",
                enabled: noSelectedNotes && parentNotSearch && isNotRoot && !isHoisted && (!note.isProtected || protectedSessionHolder.isProtectedSessionAvailable()) },
            { title: "----" },
            { title: "Export", cmd: "export", uiIcon: "empty",
                enabled: notSearch && noSelectedNotes },
            { title: "Import into note", cmd: "importIntoNote", uiIcon: "empty",
                enabled: notSearch && noSelectedNotes }
        ].filter(row => row !== null);
    }

    async selectContextMenuItem(event, cmd) {
        if (cmd === 'openInTab') {
            const notePath = await treeUtils.getNotePath(this.node);

            noteDetailService.openInTab(notePath, false);
        }
        else if (cmd.startsWith("insertNoteAfter")) {
            const parentNoteId = this.node.data.parentNoteId;
            const isProtected = await treeUtils.getParentProtectedStatus(this.node);
            const type = cmd.split("_")[1];

            treeService.createNote(this.node, parentNoteId, 'after', {
                type: type,
                isProtected: isProtected
            });
        }
        else if (cmd.startsWith("insertChildNote")) {
            const type = cmd.split("_")[1];

            treeService.createNote(this.node, this.node.data.noteId, 'into', {
                type: type,
                isProtected: this.node.data.isProtected
            });
        }
        else if (cmd === "editBranchPrefix") {
            const branchPrefixDialog = await import('../dialogs/branch_prefix.js');
            branchPrefixDialog.showDialog(this.node);
        }
        else if (cmd === "protectSubtree") {
            protectedSessionService.protectSubtree(this.node.data.noteId, true);
        }
        else if (cmd === "unprotectSubtree") {
            protectedSessionService.protectSubtree(this.node.data.noteId, false);
        }
        else if (cmd === "copy") {
            clipboard.copy(treeService.getSelectedOrActiveNodes(this.node));
        }
        else if (cmd === "cloneTo") {
            const nodes = treeService.getSelectedOrActiveNodes(this.node);
            const noteIds = nodes.map(node => node.data.noteId);

            import("../dialogs/clone_to.js").then(d => d.showDialog(noteIds));
        }
        else if (cmd === "cut") {
            clipboard.cut(treeService.getSelectedOrActiveNodes(this.node));
        }
        else if (cmd === "moveTo") {
            const nodes = treeService.getSelectedOrActiveNodes(this.node);

            import("../dialogs/move_to.js").then(d => d.showDialog(nodes));
        }
        else if (cmd === "pasteAfter") {
            clipboard.pasteAfter(this.node);
        }
        else if (cmd === "pasteInto") {
            clipboard.pasteInto(this.node);
        }
        else if (cmd === "delete") {
            treeChangesService.deleteNodes(treeService.getSelectedOrActiveNodes(this.node));
        }
        else if (cmd === "export") {
            const exportDialog = await import('../dialogs/export.js');
            exportDialog.showDialog(this.node,"subtree");
        }
        else if (cmd === "importIntoNote") {
            const importDialog = await import('../dialogs/import.js');
            importDialog.showDialog(this.node);
        }
        else if (cmd === "collapseSubtree") {
            treeService.collapseTree(this.node);
        }
        else if (cmd === "forceNoteSync") {
            syncService.forceNoteSync(this.node.data.noteId);
        }
        else if (cmd === "sortAlphabetically") {
            treeService.sortAlphabetically(this.node.data.noteId);
        }
        else if (cmd === "hoist") {
            hoistedNoteService.setHoistedNoteId(this.node.data.noteId);
        }
        else if (cmd === "unhoist") {
            hoistedNoteService.unhoist();
        }
        else if (cmd === "duplicateNote") {
            const branch = treeCache.getBranch(this.node.data.branchId);

            treeService.duplicateNote(this.node.data.noteId, branch.parentNoteId);
        }
        else if (cmd === "searchInSubtree") {
            searchNotesService.searchInSubtree(this.node.data.noteId);
        }
        else {
            ws.logError("Unknown command: " + cmd);
        }
    }
}

export default TreeContextMenu;