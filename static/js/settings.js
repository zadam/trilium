function displaySettings() {
    $.ajax({
        url: baseApiUrl + 'settings',
        type: 'GET',
        success: function (result) {
            $("#encryptionTimeoutInSeconds").val(result['encryption_session_timeout']);
            $("#historySnapshotTimeIntervalInSeconds").val(result['history_snapshot_time_interval']);
        },
        error: () => alert("Error getting settings.")
    });

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
        url: baseApiUrl + 'password/change',
        type: 'POST',
        data: JSON.stringify({
            'current_password': oldPassword,
            'new_password': newPassword1
        }),
        contentType: "application/json",
        success: function (result) {
            if (result.success) {
                // encryption password changed so current encryption session is invalid and needs to be cleared
                resetEncryptionSession();

                globalEncryptedDataKey = result.new_encrypted_data_key;

                alert("Password has been changed.");

                $("#settingsDialog").dialog('close');
            }
            else {
                alert(result.message);
            }
        },
        error: () => alert("Error occurred during changing password.")
    });

    return false;
});

$("#encryptionTimeoutForm").submit(() => {
    const encryptionTimeout = $("#encryptionTimeoutInSeconds").val();

    $.ajax({
        url: baseApiUrl + 'settings',
        type: 'POST',
        data: JSON.stringify({
            name: 'encryption_session_timeout',
            value: encryptionTimeout
        }),
        contentType: "application/json",
        success: function () {
            alert("Encryption timeout has been changed.");

            globalEncryptionSessionTimeout = encryptionTimeout;
         },
        error: () => alert("Error occurred during changing encryption timeout.")
    });

    return false;
});

$("#historySnapshotTimeIntervalForm").submit(() => {
    const historySnapshotTimeInterval = $("#historySnapshotTimeIntervalInSeconds").val();

    $.ajax({
        url: baseApiUrl + 'settings',
        type: 'POST',
        data: JSON.stringify({
            name: 'history_snapshot_time_interval',
            value: historySnapshotTimeInterval
        }),
        contentType: "application/json",
        success: function () {
            alert("History snapshot time interval has been changed.");
         },
        error: () => alert("Error occurred during changing history snapshot time interval.")
    });

    return false;
});