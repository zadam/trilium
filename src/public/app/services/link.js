import treeService from './tree.js';
import contextMenu from "./context_menu.js";
import appContext from "./app_context.js";

function getNotePathFromUrl(url) {
    const notePathMatch = /#(root[A-Za-z0-9/]*)$/.exec(url);

    return notePathMatch === null ? null : notePathMatch[1];
}

async function createNoteLink(notePath, options = {}) {
    if (!notePath || !notePath.trim()) {
        console.error("Missing note path");

        return $("<span>").text("[missing note]");
    }

    let noteTitle = options.title;
    const showTooltip = options.showTooltip === undefined ? true : options.showTooltip;
    const showNotePath = options.showNotePath === undefined ? false : options.showNotePath;

    if (!noteTitle) {
        const {noteId, parentNoteId} = treeService.getNoteIdAndParentIdFromNotePath(notePath);

        noteTitle = await treeService.getNoteTitle(noteId, parentNoteId);
    }

    const $noteLink = $("<a>", {
        href: 'javascript:',
        text: noteTitle
    }).attr('data-action', 'note')
        .attr('data-note-path', notePath);

    if (!showTooltip) {
        $noteLink.addClass("no-tooltip-preview");
    }

    const $container = $("<span>").append($noteLink);

    if (showNotePath) {
        notePath = await treeService.resolveNotePath(notePath);

        if (notePath) {
            const noteIds = notePath.split("/");
            noteIds.pop(); // remove last element

            const parentNotePath = noteIds.join("/").trim();

            if (parentNotePath) {
                $container.append($("<small>").text(" (" + await treeService.getNotePathTitle(parentNotePath) + ")"));
            }
        }
    }

    return $container;
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
    e.preventDefault();
    e.stopPropagation();

    const $link = $(e.target).closest("a");

    const notePath = getNotePathFromLink($link);

    if (notePath) {
        if ((e.which === 1 && e.ctrlKey) || e.which === 2) {
            appContext.tabManager.openTabWithNote(notePath);
        }
        else if (e.which === 1) {
            const activeTabContext = appContext.tabManager.getActiveTabContext();
            activeTabContext.setNote(notePath);
        }
        else {
            return false;
        }
    }
    else {
        if (e.which === 1) {
            const address = $link.attr('href');

            if (address && address.startsWith('http')) {
                window.open(address, '_blank');
            }
        }
        else {
            return false;
        }
    }

    return true;
}

function linkContextMenu(e) {
    const $link = $(e.target).closest("a");

    const notePath = getNotePathFromLink($link);

    if (!notePath) {
        return;
    }

    e.preventDefault();

    contextMenu.show({
        x: e.pageX,
        y: e.pageY,
        items: [
            {title: "Open note in new tab", command: "openNoteInNewTab", uiIcon: "empty"},
            {title: "Open note in new window", command: "openNoteInNewWindow", uiIcon: "window-open"}
        ],
        selectMenuItemHandler: ({command}) => {
            if (command === 'openNoteInNewTab') {
                appContext.tabManager.openTabWithNote(notePath);
            }
            else if (command === 'openNoteInNewWindow') {
                appContext.openInNewWindow(notePath);
            }
        }
    });
}

// when click on link popup, in case of internal link, just go the the referenced note instead of default behavior
// of opening the link in new window/tab
$(document).on('mousedown', "a[data-action='note']", goToLink);
$(document).on('mousedown', 'div.popover-content a, div.ui-tooltip-content a', goToLink);
$(document).on('dblclick', '.note-detail-text a', goToLink);
$(document).on('mousedown', '.note-detail-text a:not(.reference-link)', function (e) {
    const $link = $(e.target).closest("a");
    const notePath = getNotePathFromLink($link);

    if ((e.which === 1 && e.ctrlKey) || e.which === 2) {
        // if it's a ctrl-click, then we open on new tab, otherwise normal flow (CKEditor opens link-editing dialog)
        e.preventDefault();

        if (notePath) {
            appContext.tabManager.openTabWithNote(notePath, false);
        }
        else {
            const address = $link.attr('href');

            window.open(address, '_blank');
        }

        return true;
    }
});

$(document).on('mousedown', '.note-detail-book a', goToLink);
$(document).on('mousedown', '.note-detail-render a', goToLink);
$(document).on('mousedown', '.note-detail-text a.reference-link', goToLink);
$(document).on('mousedown', '.note-detail-readonly-text a.reference-link', goToLink);
$(document).on('mousedown', '.note-detail-readonly-text a', goToLink);
$(document).on('mousedown', 'a.ck-link-actions__preview', goToLink);
$(document).on('click', 'section.include-note a', goToLink);
$(document).on('click', 'a.ck-link-actions__preview', e => {
    e.preventDefault();
    e.stopPropagation();
});

$(document).on('contextmenu', 'a.ck-link-actions__preview', linkContextMenu);
$(document).on('contextmenu', '.note-detail-text a', linkContextMenu);
$(document).on('contextmenu', '.note-detail-readonly-text a', linkContextMenu);
$(document).on('contextmenu', "a[data-action='note']", linkContextMenu);
$(document).on('contextmenu', ".note-detail-render a", linkContextMenu);
$(document).on('contextmenu', ".note-paths-widget a", linkContextMenu);
$(document).on('contextmenu', "section.include-note a", linkContextMenu);

export default {
    getNotePathFromUrl,
    createNoteLink,
    goToLink
};
