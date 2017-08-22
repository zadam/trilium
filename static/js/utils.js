function message(str) {
    const top = $("#top-message");

    top.fadeIn(1500);
    top.html(str);
    top.fadeOut(1500);
}

function error(str) {
    const error = $("#error-message");

    error.show();
    error.html(str);
    error.fadeOut(10000);
}