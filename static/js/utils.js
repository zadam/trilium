function message(str) {
    $("#top-message").fadeIn(1500);
    $("#top-message").html(str);
    $("#top-message").fadeOut(1500);
}

function error(str) {
    $("#error-message").show();
    $("#error-message").html(str);
    $("#error-message").fadeOut(10000);
}