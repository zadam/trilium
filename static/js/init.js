$(function() {
    $(window).resize(function() {
        $('ul.fancytree-container').height($(window).height() - $('ul.fancytree-container').offset().top - 10);
        $('div.note-editable').height($(window).height() - $('div.note-editable').offset().top);
    });
    $(window).resize();
});

jQuery.hotkeys.options.filterInputAcceptingElements = true;
jQuery.hotkeys.options.filterContentEditable = true;

$(document).bind('keypress', 'alt+ctrl+h', function() {
    const toggle = $(".hide-toggle");

    // use visibility instead of display so that content isn't moved around and stays set in place
    toggle.css('visibility', toggle.css('visibility') === 'hidden' ? 'visible' : 'hidden');
});

$(document).bind('keypress', 'alt+q', function() {
    $("#recentNotesDialog").dialog({
        modal: true
    });

    let recentNotesSelectBox = $('#recentNotesSelectBox');

    recentNotesSelectBox.find('option').remove();

    // remove the current note
    let recNotes = recentNotes.filter(note => note.noteId !== globalNote.detail.note_id);

    $.each(recNotes, function(key, value) {
        let option = $("<option></option>")
                .attr("value", value.noteId)
                .text(value.noteTitle);

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