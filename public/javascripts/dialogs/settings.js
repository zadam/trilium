"use strict";

const settings = (function() {
    const dialogEl = $("#settings-dialog");
    const tabsEl = $("#settings-tabs");

    const settingModules = [];

    function addModule(module) {
        settingModules.push(module);
    }

    async function showDialog() {
        glob.activeDialog = dialogEl;

        const settings = await $.ajax({
            url: baseApiUrl + 'settings',
            type: 'GET',
            error: () => showError("Error getting settings.")
        });

        dialogEl.dialog({
            modal: true,
            width: 800
        });

        tabsEl.tabs();

        for (const module of settingModules) {
            module.settingsLoaded(settings);
        }
    }

    function saveSettings(settingName, settingValue) {
        return $.ajax({
            url: baseApiUrl + 'settings',
            type: 'POST',
            data: JSON.stringify({
                name: settingName,
                value: settingValue
            }),
            contentType: "application/json",
            success: () => {
                showMessage("Settings change have been saved.");
            },
            error: () => alert("Error occurred during saving settings change.")
        });
    }

    return {
        showDialog,
        saveSettings,
        addModule
    };
})();

settings.addModule((function() {
    const formEl = $("#change-password-form");
    const oldPasswordEl = $("#old-password");
    const newPassword1El = $("#new-password1");
    const newPassword2El = $("#new-password2");

    function settingsLoaded(settings) {
    }

    formEl.submit(() => {
        const oldPassword = oldPasswordEl.val();
        const newPassword1 = newPassword1El.val();
        const newPassword2 = newPassword2El.val();

        oldPasswordEl.val('');
        newPassword1El.val('');
        newPassword2El.val('');

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
                    alert("Password has been changed. Trilium will be reloaded after you press OK.");

                    // encryption password changed so current encryption session is invalid and needs to be cleared
                    encryption.resetProtectedSession();
                }
                else {
                    showError(result.message);
                }
            },
            error: () => showError("Error occurred during changing password.")
        });

        return false;
    });

    return {
        settingsLoaded
    };
})());

settings.addModule((function() {
    const formEl = $("#encryption-timeout-form");
    const encryptionTimeoutEl = $("#encryption-timeout-in-seconds");
    const settingName = 'encryption_session_timeout';

    function settingsLoaded(settings) {
        encryptionTimeoutEl.val(settings[settingName]);
    }

    formEl.submit(() => {
        const encryptionTimeout = encryptionTimeoutEl.val();

        settings.saveSettings(settingName, encryptionTimeout).then(() => {
            encryption.setEncryptionSessionTimeout(encryptionTimeout);
        });

        return false;
    });

    return {
        settingsLoaded
    };
})());

settings.addModule((function () {
    const formEl = $("#history-snapshot-time-interval-form");
    const timeIntervalEl = $("#history-snapshot-time-interval-in-seconds");
    const settingName = 'history_snapshot_time_interval';

    function settingsLoaded(settings) {
        timeIntervalEl.val(settings[settingName]);
    }

    formEl.submit(() => {
        settings.saveSettings(settingName, timeIntervalEl.val());

        return false;
    });

    return {
        settingsLoaded
    };
})());

settings.addModule((function () {
    const buildDateEl = $("#build-date");
    const buildRevisionEl = $("#build-revision");

    function settingsLoaded(settings) {
        buildDateEl.html(settings['buildDate']);
        buildRevisionEl.html(settings['buildRevision']);
        buildRevisionEl.attr('href', 'https://github.com/zadam/trilium/commit/' + settings['buildRevision']);
    }

    return {
        settingsLoaded
    };
})());