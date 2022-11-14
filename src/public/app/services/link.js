import treeService from './tree.js';
import linkContextMenuService from "./link_context_menu.js";
import appContext from "./app_context.js";
import froca from "./froca.js";
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

    if (!notePath.startsWith("root")) {
        // all note paths should start with "root/" (except for "root" itself)
        // used e.g. to find internal links
        notePath = "root/" + notePath;
    }

    let noteTitle = options.title;
    const showTooltip = options.showTooltip === undefined ? true : options.showTooltip;
    const showNotePath = options.showNotePath === undefined ? false : options.showNotePath;
    const showNoteIcon = options.showNoteIcon === undefined ? false : options.showNoteIcon;
    const referenceLink = options.referenceLink === undefined ? false : options.referenceLink;

    const {noteId, parentNoteId} = treeService.getNoteIdAndParentIdFromNotePath(notePath);

    if (!noteTitle) {
        noteTitle = await treeService.getNoteTitle(noteId, parentNoteId);
    }

    const $container = $("<span>");

    if (showNoteIcon) {
        const note = await froca.getNote(noteId);

        $container
            .append($("<span>").addClass("bx " + note.getIcon()))
            .append(" ");
    }

    const $noteLink = $("<a>", {
        href: '#' + notePath,
        text: noteTitle
    }).attr('data-action', 'note')
        .attr('data-note-path', notePath);

    if (!showTooltip) {
        $noteLink.addClass("no-tooltip-preview");
    }

    if (referenceLink) {
        $noteLink.addClass("reference-link");
    }

    $container.append($noteLink);

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
    const $link = $(e.target).closest("a,.block-link");
    const address = $link.attr('href');

    if (address?.startsWith("data:")) {
        return true;
    }

    e.preventDefault();
    e.stopPropagation();

    const notePath = getNotePathFromLink($link);

    const ctrlKey = (!utils.isMac() && e.ctrlKey) || (utils.isMac() && e.metaKey);

    if (notePath) {
        if ((e.which === 1 && ctrlKey) || e.which === 2) {
            appContext.tabManager.openTabWithNoteWithHoisting(notePath);
        }
        else if (e.which === 1) {
            const ntxId = $(e.target).closest("[data-ntx-id]").attr("data-ntx-id");

            const noteContext = ntxId
                ? appContext.tabManager.getNoteContextById(ntxId)
                : appContext.tabManager.getActiveContext();

            noteContext.setNote(notePath).then(() => {
                if (noteContext !== appContext.tabManager.getActiveContext()) {
                    appContext.tabManager.activateNoteContext(noteContext.ntxId);
                }
            });
        }
    }
    else {
        if ((e.which === 1 && ctrlKey) || e.which === 2
            || $link.hasClass("ck-link-actions__preview") // within edit link dialog single click suffices
            || $link.closest("[contenteditable]").length === 0 // outside of CKEditor single click suffices
        ) {
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

    linkContextMenuService.openContextMenu(notePath, e);
}

async function loadReferenceLinkTitle(noteId, $el) {
    const note = await froca.getNote(noteId, true);

    let title;

    if (!note) {
        title = '[missing]';
    }
    else {
        title = note.isDeleted ? `${note.title} (deleted)` : note.title;
    }

    $el.addClass(note.getColorClass());
    $el.text(title);

    $el.prepend($("<span>").addClass(note.getIcon()));
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

$(document).on('mousedown', 'a', e => {
    if (e.which === 2) {
        // prevent paste on middle click
        // https://github.com/zadam/trilium/issues/2995
        // https://developer.mozilla.org/en-US/docs/Web/API/Element/auxclick_event#preventing_default_actions
        e.preventDefault();
        return false;
    }
});

export default {
    getNotePathFromUrl,
    createNoteLink,
    goToLink,
    loadReferenceLinkTitle
};
