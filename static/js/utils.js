function message(str) {
    $("#top-message").show();
    $("#top-message").html(str);
    $("#top-message").fadeOut(3000);
}

function error(str) {
    $("#error-message").show();
    $("#error-message").html(str);
    $("#error-message").fadeOut(10000);
}