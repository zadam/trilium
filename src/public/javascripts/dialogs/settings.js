"use strict";

import protectedSessionHolder from '../services/protected_session_holder.js';
import utils from '../services/utils.js';
import server from '../services/server.js';
import infoService from "../services/info.js";

const $dialog = $("#settings-dialog");
const $tabs = $("#settings-tabs");

const tabHandlers = [];

function addTabHandler(handler) {
    tabHandlers.push(handler);
}

async function showDialog() {
    glob.activeDialog = $dialog;

    const settings = await server.get('settings');

    $dialog.dialog({
        modal: true,
        width: 900
    });

    $tabs.tabs();

    for (const handler of tabHandlers) {
        if (handler.settingsLoaded) {
            handler.settingsLoaded(settings);
        }
    }
}

async function saveSettings(settingName, settingValue) {
    await server.post('settings', {
        name: settingName,
        value: settingValue
    });

    infoService.showMessage("Settings change have been saved.");
}

export default {
    showDialog,
    saveSettings
};

addTabHandler((function() {
    const $form = $("#change-password-form");
    const $oldPassword = $("#old-password");
    const $newPassword1 = $("#new-password1");
    const $newPassword2 = $("#new-password2");

    function settingsLoaded(settings) {
    }

    $form.submit(() => {
        const oldPassword = $oldPassword.val();
        const newPassword1 = $newPassword1.val();
        const newPassword2 = $newPassword2.val();

        $oldPassword.val('');
        $newPassword1.val('');
        $newPassword2.val('');

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
                protectedSessionHolder.resetProtectedSession();
            }
            else {
                infoService.showError(result.message);
            }
        });

        return false;
    });

    return {
        settingsLoaded
    };
})());

addTabHandler((function() {
    const $form = $("#protected-session-timeout-form");
    const $protectedSessionTimeout = $("#protected-session-timeout-in-seconds");
    const settingName = 'protected_session_timeout';

    function settingsLoaded(settings) {
        $protectedSessionTimeout.val(settings[settingName]);
    }

    $form.submit(() => {
        const protectedSessionTimeout = $protectedSessionTimeout.val();

        settings.saveSettings(settingName, protectedSessionTimeout).then(() => {
            protectedSessionHolder.setProtectedSessionTimeout(protectedSessionTimeout);
        });

        return false;
    });

    return {
        settingsLoaded
    };
})());

addTabHandler((function () {
    const $form = $("#note-revision-snapshot-time-interval-form");
    const $timeInterval = $("#note-revision-snapshot-time-interval-in-seconds");
    const settingName = 'note_revision_snapshot_time_interval';

    function settingsLoaded(settings) {
        $timeInterval.val(settings[settingName]);
    }

    $form.submit(() => {
        settings.saveSettings(settingName, $timeInterval.val());

        return false;
    });

    return {
        settingsLoaded
    };
})());

addTabHandler((async function () {
    const $appVersion = $("#app-version");
    const $dbVersion = $("#db-version");
    const $buildDate = $("#build-date");
    const $buildRevision = $("#build-revision");

    const appInfo = await server.get('app-info');

    $appVersion.html(appInfo.app_version);
    $dbVersion.html(appInfo.db_version);
    $buildDate.html(appInfo.build_date);
    $buildRevision.html(appInfo.build_revision);
    $buildRevision.attr('href', 'https://github.com/zadam/trilium/commit/' + appInfo.build_revision);

    return {};
})());

addTabHandler((async function () {
    const $forceFullSyncButton = $("#force-full-sync-button");
    const $fillSyncRowsButton = $("#fill-sync-rows-button");
    const $anonymizeButton = $("#anonymize-button");
    const $cleanupSoftDeletedButton = $("#cleanup-soft-deleted-items-button");
    const $cleanupUnusedImagesButton = $("#cleanup-unused-images-button");
    const $vacuumDatabaseButton = $("#vacuum-database-button");

    $forceFullSyncButton.click(async () => {
        await server.post('sync/force-full-sync');

        infoService.showMessage("Full sync triggered");
    });

    $fillSyncRowsButton.click(async () => {
        await server.post('sync/fill-sync-rows');

        infoService.showMessage("Sync rows filled successfully");
    });


    $anonymizeButton.click(async () => {
        await server.post('anonymization/anonymize');

        infoService.showMessage("Created anonymized database");
    });

    $cleanupSoftDeletedButton.click(async () => {
        if (confirm("Do you really want to clean up soft-deleted items?")) {
            await server.post('cleanup/cleanup-soft-deleted-items');

            infoService.showMessage("Soft deleted items have been cleaned up");
        }
    });

    $cleanupUnusedImagesButton.click(async () => {
        if (confirm("Do you really want to clean up unused images?")) {
            await server.post('cleanup/cleanup-unused-images');

            infoService.showMessage("Unused images have been cleaned up");
        }
    });

    $vacuumDatabaseButton.click(async () => {
        await server.post('cleanup/vacuum-database');

        infoService.showMessage("Database has been vacuumed");
    });

    return {};
})());