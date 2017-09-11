function displaySettings() {
    $("#settingsDialog").dialog({
        modal: true,
        width: 600
    });

    $("#settingsTabs").tabs();
}

$("#changePasswordForm").submit(() => {
    console.log("Submit");

    return false;
});