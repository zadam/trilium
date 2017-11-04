function displaySettings() {
    $.ajax({
        url: baseApiUrl + 'settings',
        type: 'GET',
        success: result => {
            $("#encryption-timeout-in-seconds").val(result['encryption_session_timeout']);
            $("#history-snapshot-time-interval-in-seconds").val(result['history_snapshot_time_interval']);
        },
        error: () => alert("Error getting settings.")
    });

    $("#settings-dialog").dialog({
        modal: true,
        width: 600
    });

    $("#settings-tabs").tabs();
}

$("#change-password-form").submit(() => {
    const oldPassword = $("#old-password").val();
    const newPassword1 = $("#new-password1").val();
    const newPassword2 = $("#new-password2").val();

    $("#old-password").val('');
    $("#new-password1").val('');
    $("#new-password2").val('');

    if (newPassword1 !== newPassword2) {
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
        success: result => {
            if (result.success) {
                // encryption password changed so current encryption session is invalid and needs to be cleared
                resetEncryptionSession();

                glob.encryptedDataKey = result.new_encrypted_data_key;

                alert("Password has been changed.");

                $("#settings-dialog").dialog('close');
            }
            else {
                alert(result.message);
            }
        },
        error: () => alert("Error occurred during changing password.")
    });

    return false;
});

$("#encryption-timeout-form").submit(() => {
    const encryptionTimeout = $("#encryption-timeout-in-seconds").val();

    $.ajax({
        url: baseApiUrl + 'settings',
        type: 'POST',
        data: JSON.stringify({
            name: 'encryption_session_timeout',
            value: encryptionTimeout
        }),
        contentType: "application/json",
        success: () => {
            alert("Encryption timeout has been changed.");

            glob.encryptionSessionTimeout = encryptionTimeout;
         },
        error: () => alert("Error occurred during changing encryption timeout.")
    });

    return false;
});

$("#history-snapshot-time-interval-form").submit(() => {
    const historySnapshotTimeInterval = $("#history-snapshot-time-interval-in-seconds").val();

    $.ajax({
        url: baseApiUrl + 'settings',
        type: 'POST',
        data: JSON.stringify({
            name: 'history_snapshot_time_interval',
            value: historySnapshotTimeInterval
        }),
        contentType: "application/json",
        success: () => {
            alert("History snapshot time interval has been changed.");
         },
        error: () => alert("Error occurred during changing history snapshot time interval.")
    });

    return false;
});