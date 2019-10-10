import treeService from './tree.js';
import treeUtils from './tree_utils.js';
import contextMenuService from "./context_menu.js";
import noteDetailService from "./note_detail.js";

function getNotePathFromUrl(url) {
    const notePathMatch = /#(root[A-Za-z0-9/]*)$/.exec(url);

    if (notePathMatch === null) {
        return null;
    }
    else {
        return notePathMatch[1];
    }
}

async function createNoteLink(notePath, noteTitle = null) {
    if (!noteTitle) {
        const noteId = treeUtils.getNoteIdFromNotePath(notePath);

        noteTitle = await treeUtils.getNoteTitle(noteId);
    }

    const noteLink = $("<a>", {
        href: 'javascript:',
        text: noteTitle
    }).attr('data-action', 'note')
        .attr('data-note-path', notePath);

    return noteLink;
}

async function createNoteLinkWithPath(notePath, noteTitle = null) {
    const $link = await createNoteLink(notePath, noteTitle);

    const $res = $("<span>").append($link);

    if (notePath.includes("/")) {
        const noteIds = notePath.split("/");
        noteIds.pop(); // remove last element

        const parentNotePath = noteIds.join("/").trim();

        if (parentNotePath) {
            $res.append($("<small>").text(" (" + await treeUtils.getNotePathTitle(parentNotePath) + ")"));
        }
    }

    return $res;
}

function getNotePathFromLink($link) {
    const notePathAttr = $link.attr("data-note-path");

    if (notePathAttr) {
        return notePathAttr;
    }

    const url = $link.attr('href');

    return url ? getNotePathFromUrl(url) : null;
}

function goToLink(e) {
    const $link = $(e.target);

    const notePath = getNotePathFromLink($link);

    if (notePath) {
        if ((e.which === 1 && e.ctrlKey) || e.which === 2) {
            noteDetailService.openInTab(notePath);
        }
        else if (e.which === 1) {
            treeService.activateNote(notePath);
        }
        else {
            return false;
        }
    }
    else {
        const address = $link.attr('href');

        if (address && address.startsWith('http')) {
            window.open(address, '_blank');
        }
    }

    e.preventDefault();
    e.stopPropagation();

    return true;
}

function addLinkToEditor(linkTitle, linkHref) {
    const editor = noteDetailService.getActiveEditor();

    if (editor) {
        editor.model.change(writer => {
            const insertPosition = editor.model.document.selection.getFirstPosition();
            writer.insertText(linkTitle, {linkHref: linkHref}, insertPosition);
        });
    }
}

function addTextToEditor(text) {
    const editor = noteDetailService.getActiveEditor();

    if (editor) {
        editor.model.change(writer => {
            const insertPosition = editor.model.document.selection.getFirstPosition();
            writer.insertText(text, insertPosition);
        });
    }
}

function newTabContextMenu(e) {
    const $link = $(e.target);

    const notePath = getNotePathFromLink($link);

    if (!notePath) {
        return;
    }

    e.preventDefault();

    contextMenuService.initContextMenu(e, {
        getContextMenuItems: () => {
            return [
                {title: "Open note in new tab", cmd: "openNoteInNewTab", uiIcon: "arrow-up-right"}
            ];
        },
        selectContextMenuItem: (e, cmd) => {
            if (cmd === 'openNoteInNewTab') {
                noteDetailService.loadNoteDetail(notePath.split("/").pop(), { newTab: true });
            }
        }
    });
}

$(document).on('contextmenu', '.note-detail-text a', newTabContextMenu);
$(document).on('contextmenu', "a[data-action='note']", newTabContextMenu);
$(document).on('contextmenu', ".note-detail-render a", newTabContextMenu);

// when click on link popup, in case of internal link, just go the the referenced note instead of default behavior
// of opening the link in new window/tab
$(document).on('mousedown', "a[data-action='note']", goToLink);
$(document).on('mousedown', 'div.popover-content a, div.ui-tooltip-content a', goToLink);
$(document).on('dblclick', '.note-detail-text a', goToLink);
$(document).on('mousedown', '.note-detail-text a', function (e) {
    const notePath = getNotePathFromLink($(e.target));
    if (notePath && ((e.which === 1 && e.ctrlKey) || e.which === 2)) {
        // if it's a ctrl-click, then we open on new tab, otherwise normal flow (CKEditor opens link-editing dialog)
        e.preventDefault();

        noteDetailService.loadNoteDetail(notePath, { newTab: true });

        return true;
    }
});

$(document).on('mousedown', '.note-detail-render a', goToLink);
$(document).on('mousedown', '.note-detail-text.ck-read-only a', goToLink);
$(document).on('mousedown', 'span.ck-button__label', e => {
    // this is a link preview dialog from CKEditor link editing
    // for some reason clicked element is span

    const url = $(e.target).text();
    const notePath = getNotePathFromUrl(url);

    if (notePath) {
        treeService.activateNote(notePath);

        e.preventDefault();
    }
});

export default {
    getNotePathFromUrl,
    createNoteLink,
    createNoteLinkWithPath,
    addLinkToEditor,
    addTextToEditor,
    goToLink
};