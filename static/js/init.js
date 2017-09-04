$(function() {
    $(window).resize(function() {
        const fancyTree = $('ul.fancytree-container');

        if (fancyTree.length) {
            fancyTree.height($(window).height() - fancyTree.offset().top - 10);
        }

        const noteEditable = $('div.note-editable');

        if (noteEditable.length) {
            noteEditable.height($(window).height() - noteEditable.offset().top);
        }
    });
    $(window).resize();
});

jQuery.hotkeys.options.filterInputAcceptingElements = true;
jQuery.hotkeys.options.filterContentEditable = true;

$(document).bind('keydown', 'alt+h', function() {
    const toggle = $(".hide-toggle");
    const hidden = toggle.css('display') === 'none';

    toggle.css('display', hidden ? 'block' : 'none');

    $("#noteDetailWrapper").css("width", hidden ? "750px" : "100%");
});

$(document).bind('keydown', 'alt+q', function() {
    $("#recentNotesDialog").dialog({
        modal: true,
        width: 500
    });

    let recentNotesSelectBox = $('#recentNotesSelectBox');

    recentNotesSelectBox.find('option').remove();

    // remove the current note
    let recNotes = recentNotes.filter(note => note !== globalNote.detail.note_id);

    $.each(recNotes, function(key, valueNoteId) {
        let noteTitle = getFullName(valueNoteId);

        if (!noteTitle) {
            return;
        }

        let option = $("<option></option>")
                .attr("value", valueNoteId)
                .text(noteTitle);

        // select the first one (most recent one) by default
        if (key === 0) {
            option.attr("selected", "selected");
        }

        recentNotesSelectBox.append(option);
    });
});

function setActiveNoteBasedOnRecentNotes() {
    let noteId = $("#recentNotesSelectBox option:selected").val();

    getNodeByKey(noteId).setActive();

    $("#recentNotesDialog").dialog('close');
}

$('#recentNotesSelectBox').keydown(function(e) {
    let key = e.which;

    if (key === 13)// the enter key code
    {
        setActiveNoteBasedOnRecentNotes();
    }
});

$('#recentNotesSelectBox').dblclick(function(e) {
    setActiveNoteBasedOnRecentNotes();
});

// when click on link popup, in case of internal link, just go the the referenced note instead of default behavior
// of opening the link in new window/tab
$(document).on('click', 'div.popover-content a', function(e) {
    const targetUrl = $(e.target).attr("href");

    const noteIdMatch = /app#([A-Za-z0-9]{22})/.exec(targetUrl);

    if (noteIdMatch !== null) {
        const noteId = noteIdMatch[1];

        getNodeByKey(noteId).setActive();

        e.preventDefault();
    }
});

function getNodeIdFromLabel(label) {
    const noteIdMatch = / \(([A-Za-z0-9]{22})\)/.exec(label);

    if (noteIdMatch !== null) {
        return noteIdMatch[1];
    }

    return null;
}

function getAutocompleteItems() {
    const autocompleteItems = [];

    for (const noteId of globalAllNoteIds) {
        const fullName = getFullName(noteId);

        autocompleteItems.push({
            value: fullName + " (" + noteId + ")",
            label: fullName
        });
    }

    return autocompleteItems;
}

$(document).bind('keydown', 'alt+l', function() {
    $("#noteAutocomplete").val('');
    $("#linkTitle").val('');

    const noteDetail = $('#noteDetail');
    noteDetail.summernote('editor.saveRange');

    $("#insertLinkDialog").dialog({
        modal: true,
        width: 500
    });

    function setDefaultLinkTitle(noteId) {
        const note = getNodeByKey(noteId);
        if (!note) {
            return;
        }

        let noteTitle = note.title;

        if (noteTitle.endsWith(" (clone)")) {
            noteTitle = noteTitle.substr(0, noteTitle.length - 8);
        }

        $("#linkTitle").val(noteTitle);
    }

    $("#noteAutocomplete").autocomplete({
        source: getAutocompleteItems(),
        minLength: 0,
        change: function () {
            const val = $("#noteAutocomplete").val();
            const noteId = getNodeIdFromLabel(val);

            if (noteId) {
                setDefaultLinkTitle(noteId);
            }
        },
        // this is called when user goes through autocomplete list with keyboard
        // at this point the item isn't selected yet so we use supplied ui.item to see where the cursor is
        focus: function (event, ui) {
            const noteId = getNodeIdFromLabel(ui.item.value);

            setDefaultLinkTitle(noteId);
        }
    });
});

$("#insertLinkForm").submit(function() {
    let val = $("#noteAutocomplete").val();

    const noteId = getNodeIdFromLabel(val);

    if (noteId) {
        const linkTitle = $("#linkTitle").val();
        const noteDetail = $('#noteDetail');

        $("#insertLinkDialog").dialog("close");

        noteDetail.summernote('editor.restoreRange');

        noteDetail.summernote('createLink', {
            text: linkTitle,
            url: 'app#' + noteId,
            isNewWindow: true
        });
    }

    return false;
});

$(document).bind('keydown', 'alt+s', function() {
    $("input[name=search]").focus();
});

$(document).bind('keydown', 'alt+t', function() {
    const date = new Date();

    const dateString = date.getDate() + ". " + (date.getMonth() + 1) + ". " + date.getFullYear() + " " +
        date.getHours() + ":" + date.getMinutes();

    $('#noteDetail').summernote('insertText', dateString);
});

$(document).bind('keydown', 'alt+j', function() {
    $("#jumpToNoteAutocomplete").val('');

    $("#jumpToNoteDialog").dialog({
        modal: true,
        width: 500
    });

    $("#jumpToNoteAutocomplete").autocomplete({
        source: getAutocompleteItems(),
        minLength: 0
    });
});

$("#jumpToNoteForm").submit(function() {
    const val = $("#jumpToNoteAutocomplete").val();
    const noteId = getNodeIdFromLabel(val);

    if (noteId) {
        getNodeByKey(noteId).setActive();

        $("#jumpToNoteDialog").dialog('close');
    }

    return false;
});