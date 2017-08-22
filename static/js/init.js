$(function() {
    $(window).resize(function() {
        $('div#tree').height($(window).height() - $('div#tree').offset().top);
        $('div.note-editable').height($(window).height() - $('div.note-editable').offset().top);
    });
    $(window).resize();
});

jQuery.hotkeys.options.filterInputAcceptingElements = true;
jQuery.hotkeys.options.filterContentEditable = true;

$(document).bind('keypress', 'alt+ctrl+h', function() {
    const toggle = $(".hide-toggle");

    toggle.css('visibility', toggle.css('visibility') === 'hidden' ? 'visible' : 'hidden');
});