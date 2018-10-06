import treeService from './tree.js';
import noteDetailText from './note_detail_text.js';
import treeUtils from './tree_utils.js';

function getNotePathFromLink(url) {
    const notePathMatch = /#(root[A-Za-z0-9/]*)$/.exec(url);

    if (notePathMatch === null) {
        return null;
    }
    else {
        return notePathMatch[1];
    }
}

function getNotePathFromLabel(label) {
    const notePathMatch = / \(([A-Za-z0-9/]+)\)/.exec(label);

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

function goToLink(e) {
    e.preventDefault();

    const $link = $(e.target);
    let notePath = $link.attr("data-note-path");

    if (!notePath) {
        const address = $link.attr("data-note-path") ? $link.attr("data-note-path") : $link.attr('href');

        if (!address) {
            return;
        }

        if (address.startsWith('http')) {
            window.open(address, '_blank');

            return;
        }

        notePath = getNotePathFromLink(address);
    }

    treeService.activateNote(notePath);

    // this is quite ugly hack, but it seems like we can't close the tooltip otherwise
    $("[role='tooltip']").remove();

    if (glob.activeDialog) {
        try {
            glob.activeDialog.dialog('close');
        }
        catch (e) {}
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

export default {
    getNotePathFromLabel,
    getNotePathFromLink,
    createNoteLink,
    addLinkToEditor,
    addTextToEditor
};