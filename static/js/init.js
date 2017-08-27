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

$(document).bind('keydown', 'alt+ctrl+h', function() {
    const toggle = $(".hide-toggle");

    // use visibility instead of display so that content isn't moved around and stays set in place
    toggle.css('visibility', toggle.css('visibility') === 'hidden' ? 'visible' : 'hidden');
});

$(document).bind('keydown', 'alt+q', function() {
    $("#recentNotesDialog").dialog({
        modal: true
    });

    let recentNotesSelectBox = $('#recentNotesSelectBox');

    recentNotesSelectBox.find('option').remove();

    // remove the current note
    let recNotes = recentNotes.filter(note => note !== globalNote.detail.note_id);

    $.each(recNotes, function(key, valueNoteId) {
        let noteTitle = globalNoteNames[valueNoteId];

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

    $("#tree").fancytree('getNodeByKey', noteId).setActive();

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