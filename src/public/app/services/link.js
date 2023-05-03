import treeService from './tree.js';
import linkContextMenuService from "../menus/link_context_menu.js";
import appContext from "../components/app_context.js";
import froca from "./froca.js";
import utils from "./utils.js";

function getNotePathFromUrl(url) {
    const notePathMatch = /#(root[A-Za-z0-9_/]*)$/.exec(url);

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
        notePath = `root/${notePath}`;
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
            .append($("<span>").addClass(`bx ${note.getIcon()}`))
            .append(" ");
    }

    const $noteLink = $("<a>", {
        href: `#${notePath}`,
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
                $container.append($("<small>").text(` (${await treeService.getNotePathTitle(parentNotePath)})`));
            }
        }
    }

    return $container;
}

function parseNotePathAndScope($link) {
    let notePath = $link.attr("data-note-path");

    if (!notePath) {
        const url = $link.attr('href');

        notePath = url ? getNotePathFromUrl(url) : null;
    }

    const viewScope = {
        viewMode: $link.attr('data-view-mode') || 'default',
        attachmentId: $link.attr('data-attachment-id'),
    };

    return {
        notePath,
        noteId: treeService.getNoteIdFromNotePath(notePath),
        viewScope
    };
}

function calculateHash({notePath, ntxId, hoistedNoteId, viewScope = {}}) {
    notePath = notePath || "";
    const params = [
        ntxId ? { ntxId: ntxId } : null,
        (hoistedNoteId && hoistedNoteId !== 'root') ? { hoistedNoteId: hoistedNoteId } : null,
        viewScope.viewMode !== 'default' ? { viewMode: viewScope.viewMode } : null,
        viewScope.attachmentId ? { attachmentId: viewScope.attachmentId } : null
    ].filter(p => !!p);

    const paramStr = params.map(pair => {
        const name = Object.keys(pair)[0];
        const value = pair[name];

        return `${encodeURIComponent(name)}=${encodeURIComponent(value)}`;
    }).join("&");

    if (!notePath && !paramStr) {
        return "";
    }

    let hash = `#${notePath}`;

    if (paramStr) {
        hash += `?${paramStr}`;
    }

    return hash;
}

function goToLink(evt) {
    const $link = $(evt.target).closest("a,.block-link");
    const hrefLink = $link.attr('href');

    if (hrefLink?.startsWith("data:")) {
        return true;
    }

    evt.preventDefault();
    evt.stopPropagation();

    const { notePath, viewScope } = parseNotePathAndScope($link);

    const ctrlKey = utils.isCtrlKey(evt);
    const isLeftClick = evt.which === 1;
    const isMiddleClick = evt.which === 2;
    const openInNewTab = (isLeftClick && ctrlKey) || isMiddleClick;

    if (notePath) {
        if (openInNewTab) {
            appContext.tabManager.openTabWithNoteWithHoisting(notePath, { viewScope });
        }
        else if (isLeftClick) {
            const ntxId = $(evt.target).closest("[data-ntx-id]").attr("data-ntx-id");

            const noteContext = ntxId
                ? appContext.tabManager.getNoteContextById(ntxId)
                : appContext.tabManager.getActiveContext();

            noteContext.setNote(notePath, { viewScope }).then(() => {
                if (noteContext !== appContext.tabManager.getActiveContext()) {
                    appContext.tabManager.activateNoteContext(noteContext.ntxId);
                }
            });
        }
    }
    else if (hrefLink) {
        // this branch handles external links
        const isWithinCKLinkDialog = $link.hasClass("ck-link-actions__preview");
        const isOutsideCKEditor = $link.closest("[contenteditable]").length === 0;

        if (openInNewTab || isWithinCKLinkDialog || isOutsideCKEditor) {
            if (hrefLink.toLowerCase().startsWith('http')) {
                window.open(hrefLink, '_blank');
            }
            else if (hrefLink.toLowerCase().startsWith('file:') && utils.isElectron()) {
                const electron = utils.dynamicRequire('electron');

                electron.shell.openPath(hrefLink);
            }
        }
    }

    return true;
}

function linkContextMenu(e) {
    const $link = $(e.target).closest("a");

    const { notePath, viewScope } = parseNotePathAndScope($link);

    if (!notePath) {
        return;
    }

    e.preventDefault();

    linkContextMenuService.openContextMenu(notePath, e, viewScope, null);
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

    if (note) {
        $el.addClass(note.getColorClass());
    }

    $el.text(title);

    if (note) {
        $el.prepend($("<span>").addClass(note.getIcon()));
    }
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
    loadReferenceLinkTitle,
    parseNotePathAndScope,
    calculateHash
};
