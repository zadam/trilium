function displaySettings() {
    $("#settingsDialog").dialog({
        modal: true,
        width: 600
    });

    $("#settingsTabs").tabs();
}

$("#changePasswordForm").submit(() => {
    const oldPassword = $("#oldPassword").val();
    const newPassword1 = $("#newPassword1").val();
    const newPassword2 = $("#newPassword2").val();

    $("#oldPassword").val('');
    $("#newPassword1").val('');
    $("#newPassword2").val('');

    if (newPassword1 != newPassword2) {
        alert("New passwords are not the same.");
        return false;
    }

    $.ajax({
        url: baseUrl + 'password/change',
        type: 'POST',
        data: JSON.stringify({
            'current_password': oldPassword,
            'new_password': newPassword1
        }),
        contentType: "application/json",
        success: function (result) {
            if (result.success) {
                alert("Password has been changed.");
            }
            else {
                alert(result.message);
            }
        },
        error: () => alert("Error occurred during changing password.")
    });

    return false;
});