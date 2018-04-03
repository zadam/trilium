import server from './services/server.js';

$("#setup-form").submit(() => {
    const username = $("#username").val();
    const password1 = $("#password1").val();
    const password2 = $("#password2").val();

    if (!username) {
        showAlert("Username can't be empty");
        return false;
    }

    if (!password1) {
        showAlert("Password can't be empty");
        return false;
    }

    if (password1 !== password2) {
        showAlert("Both password fields need be identical.");
        return false;
    }

    server.post('setup', {
        username: username,
        password: password1
    }).then(() => {
        window.location.replace("/");
    });

    return false;
});

function showAlert(message) {
    $("#alert").html(message);
    $("#alert").show();
}