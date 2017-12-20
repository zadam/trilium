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

        const settings = await server.get('settings');

        dialogEl.dialog({
            modal: true,
            width: 900
        });

        tabsEl.tabs();

        for (const module of settingModules) {
            if (module.settingsLoaded) {
                module.settingsLoaded(settings);
            }
        }
    }

    async function saveSettings(settingName, settingValue) {
        await server.post('settings', {
            name: settingName,
            value: settingValue
        });

        showMessage("Settings change have been saved.");
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

        server.post('password/change', {
            'current_password': oldPassword,
            'new_password': newPassword1
        }).then(result => {
            if (result.success) {
                alert("Password has been changed. Trilium will be reloaded after you press OK.");

                // password changed so current protected session is invalid and needs to be cleared
                protected_session.resetProtectedSession();
            }
            else {
                showError(result.message);
            }
        });

        return false;
    });

    return {
        settingsLoaded
    };
})());

settings.addModule((function() {
    const formEl = $("#protected-session-timeout-form");
    const protectedSessionTimeoutEl = $("#protected-session-timeout-in-seconds");
    const settingName = 'protected_session_timeout';

    function settingsLoaded(settings) {
        protectedSessionTimeoutEl.val(settings[settingName]);
    }

    formEl.submit(() => {
        const protectedSessionTimeout = protectedSessionTimeoutEl.val();

        settings.saveSettings(settingName, protectedSessionTimeout).then(() => {
            protected_session.setProtectedSessionTimeout(protectedSessionTimeout);
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

settings.addModule((async function () {
    const appVersionEl = $("#app-version");
    const dbVersionEl = $("#db-version");
    const buildDateEl = $("#build-date");
    const buildRevisionEl = $("#build-revision");

    const appInfo = await server.get('app-info');

    appVersionEl.html(appInfo.app_version);
    dbVersionEl.html(appInfo.db_version);
    buildDateEl.html(appInfo.build_date);
    buildRevisionEl.html(appInfo.build_revision);
    buildRevisionEl.attr('href', 'https://github.com/zadam/trilium/commit/' + appInfo.build_revision);

    return {};
})());

settings.addModule((async function () {
    const forceFullSyncButton = $("#force-full-sync-button");
    const fillSyncRowsButton = $("#fill-sync-rows-button");

    forceFullSyncButton.click(async () => {
        await server.post('sync/force-full-sync');

        showMessage("Full sync triggered");
    });

    fillSyncRowsButton.click(async () => {
        await server.post('sync/fill-sync-rows');

        showMessage("Sync rows filled successfully");
    });

    return {};
})());

settings.addModule((async function () {
    const anonymizeButton = $("#anonymize-button");

    anonymizeButton.click(async () => {
        await server.post('anonymization/anonymize');

        showMessage("Created anonymized database");
    });

    return {};
})());