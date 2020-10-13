import treeService from './tree.js';
import contextMenu from "./context_menu.js";
import appContext from "./app_context.js";
import treeCache from "./tree_cache.js";
import utils from "./utils.js";

function getNotePathFromUrl(url) {
    const notePathMatch = /#(root[A-Za-z0-9/]*)$/.exec(url);

    return notePathMatch === null ? null : notePathMatch[1];
}

async function createNoteLink(notePath, options = {}) {
    if (!notePath || !notePath.trim()) {
        logError("Missing note path");

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
        href: '#' + notePath,
        text: noteTitle
    }).attr('data-action', 'note')
        .attr('data-note-path', notePath);

    if (!showTooltip) {
        $noteLink.addClass("no-tooltip-preview");
    }

    const $container = $("<span>").append($noteLink);

    if (showNotePath) {
        const resolvedNotePathSegments = await treeService.resolveNotePathToSegments(notePath);

        if (notePath) {
            resolvedNotePathSegments.pop(); // remove last element

            const parentNotePath = resolvedNotePathSegments.join("/").trim();

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
    }
    else {
        if ((e.which === 1 && e.ctrlKey) || e.which === 2
            || $link.hasClass("ck-link-actions__preview") // within edit link dialog single click suffices
        ) {
            const address = $link.attr('href');
console.log("address", address);
            if (address) {
                if (address.toLowerCase().startsWith('http')) {
                    window.open(address, '_blank');
                }
                else if (address.toLowerCase().startsWith('file:') && utils.isElectron()) {
                    const electron = utils.dynamicRequire('electron');

                    electron.shell.openPath(address);
                }
            }
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

async function loadReferenceLinkTitle(noteId, $el) {
    const note = await treeCache.getNote(noteId, true);

    let title;

    if (!note) {
        title = '[missing]';
    }
    else if (!note.isDeleted) {
        title = note.title;
    }
    else {
        title = note.isErased ? '[erased]' : `${note.title} (deleted)`;
    }

    $el.text(title);
}

$(document).on('click', "a", goToLink);
$(document).on('auxclick', "a", goToLink); // to handle middle button
$(document).on('contextmenu', 'a', linkContextMenu);
$(document).on('dblclick', "a", e => {
    e.preventDefault();
    e.stopPropagation();

    const $link = $(e.target).closest("a");

    const address = $link.attr('href');

    if (address && address.startsWith('http')) {
        window.open(address, '_blank');
    }
});

export default {
    getNotePathFromUrl,
    createNoteLink,
    goToLink,
    loadReferenceLinkTitle
};
