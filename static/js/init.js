$(function() {
    $(window).resize(function() {
        $('div#tree').height($(window).height() - $('div#tree').offset().top);
        $('div.note-editable').height($(window).height() - $('div.note-editable').offset().top);
    });
    $(window).resize();
});