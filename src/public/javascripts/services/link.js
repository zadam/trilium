import treeService from './tree.js';
import noteDetailText from './note_detail_text.js';
import treeUtils from './tree_utils.js';

function getNotePathFromUrl(url) {
    const notePathMatch = /#(root[A-Za-z0-9/]*)$/.exec(url);

    if (notePathMatch === null) {
        return null;
    }
    else {
        return notePathMatch[1];
    }
}

function getNotePathFromLabel(label) {
    const notePathMatch = / \((root[A-Za-z0-9/]*)\)/.exec(label);

    if (notePathMatch !== null) {
        return notePathMatch[1];
    }

    return null;
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

    const $link = $(e.target);

    const notePath = getNotePathFromLink($link);

    if (notePath) {
        treeService.activateNote(notePath);
    }
    else {
        const address = $link.attr('href');

        if (address && address.startsWith('http')) {
            window.open(address, '_blank');
        }
    }
}

function addLinkToEditor(linkTitle, linkHref) {
    const editor = noteDetailText.getEditor();

    editor.model.change( writer => {
        const insertPosition = editor.model.document.selection.getFirstPosition();
        writer.insertText(linkTitle, { linkHref: linkHref }, insertPosition);
    });
}

function addTextToEditor(text) {
    const editor = noteDetailText.getEditor();

    editor.model.change(writer => {
        const insertPosition = editor.model.document.selection.getFirstPosition();
        writer.insertText(text, insertPosition);
    });
}

ko.bindingHandlers.noteLink = {
    init: async function(element, valueAccessor, allBindings, viewModel, bindingContext) {
        const noteId = ko.unwrap(valueAccessor());

        if (noteId) {
            const link = await createNoteLink(noteId);

            $(element).append(link);
        }
    }
};

// when click on link popup, in case of internal link, just go the the referenced note instead of default behavior
// of opening the link in new window/tab
$(document).on('click', "a[data-action='note']", goToLink);
$(document).on('click', 'div.popover-content a, div.ui-tooltip-content a', goToLink);
$(document).on('dblclick', '#note-detail-text a', goToLink);
$(document).on('click', 'span.ck-button__label', e => {
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
    getNotePathFromLabel,
    getNotePathFromUrl,
    createNoteLink,
    addLinkToEditor,
    addTextToEditor
};