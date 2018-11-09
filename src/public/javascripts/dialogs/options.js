"use strict";

import protectedSessionHolder from '../services/protected_session_holder.js';
import server from '../services/server.js';
import infoService from "../services/info.js";
import zoomService from "../services/zoom.js";
import utils from "../services/utils.js";

const $dialog = $("#options-dialog");

const tabHandlers = [];

function addTabHandler(handler) {
    tabHandlers.push(handler);
}

async function showDialog() {
    glob.activeDialog = $dialog;

    const options = await server.get('options');

    $dialog.modal();

    for (const handler of tabHandlers) {
        if (handler.optionsLoaded) {
            handler.optionsLoaded(options);
        }
    }
}

async function saveOptions(options) {
    await server.put('options', options);

    infoService.showMessage("Options change have been saved.");
}

export default {
    showDialog,
    saveOptions
};

addTabHandler((function() {
    const $themeSelect = $("#theme-select");
    const $zoomFactorSelect = $("#zoom-factor-select");
    const $leftPaneMinWidth = $("#left-pane-min-width");
    const $leftPaneWidthPercent = $("#left-pane-width-percent");
    const $html = $("html");
    const $container = $("#container");

    function optionsLoaded(options) {
        $themeSelect.val(options.theme);

        if (utils.isElectron()) {
            $zoomFactorSelect.val(options.zoomFactor);
        }
        else {
            $zoomFactorSelect.prop('disabled', true);
        }

        $leftPaneMinWidth.val(options.leftPaneMinWidth);
        $leftPaneWidthPercent.val(options.leftPaneWidthPercent);
    }

    $themeSelect.change(function() {
        const newTheme = $(this).val();

        $html.attr("class", "theme-" + newTheme);

        server.put('options/theme/' + newTheme);
    });

    $zoomFactorSelect.change(function() {
        const newZoomFactor = $(this).val();

        zoomService.setZoomFactorAndSave(newZoomFactor);
    });

    function resizeLeftPanel() {
        const leftPanePercent = parseInt($leftPaneWidthPercent.val());
        const rightPanePercent = 100 - leftPanePercent;
        const leftPaneMinWidth = $leftPaneMinWidth.val();

        $container.css("grid-template-columns", `minmax(${leftPaneMinWidth}px, ${leftPanePercent}fr) ${rightPanePercent}fr`);
    }

    $leftPaneMinWidth.change(function() {
        const newMinWidth = $(this).val();

        resizeLeftPanel();

        server.put('options/leftPaneMinWidth/' + newMinWidth);
    });

    $leftPaneWidthPercent.change(function() {
        const newWidthPercent = $(this).val();

        resizeLeftPanel();

        server.put('options/leftPaneWidthPercent/' + newWidthPercent);
    });

    return {
        optionsLoaded
    };
})());

addTabHandler((function() {
    const $form = $("#change-password-form");
    const $oldPassword = $("#old-password");
    const $newPassword1 = $("#new-password1");
    const $newPassword2 = $("#new-password2");

    function optionsLoaded(options) {
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
        optionsLoaded
    };
})());

addTabHandler((function() {
    const $form = $("#protected-session-timeout-form");
    const $protectedSessionTimeout = $("#protected-session-timeout-in-seconds");

    function optionsLoaded(options) {
        $protectedSessionTimeout.val(options['protectedSessionTimeout']);
    }

    $form.submit(() => {
        const protectedSessionTimeout = $protectedSessionTimeout.val();

        saveOptions({ 'protectedSessionTimeout': protectedSessionTimeout }).then(() => {
            protectedSessionHolder.setProtectedSessionTimeout(protectedSessionTimeout);
        });

        return false;
    });

    return {
        optionsLoaded
    };
})());

addTabHandler((function () {
    const $form = $("#note-revision-snapshot-time-interval-form");
    const $timeInterval = $("#note-revision-snapshot-time-interval-in-seconds");

    function optionsLoaded(options) {
        $timeInterval.val(options['noteRevisionSnapshotTimeInterval']);
    }

    $form.submit(() => {
        saveOptions({ 'noteRevisionSnapshotTimeInterval': $timeInterval.val() });

        return false;
    });

    return {
        optionsLoaded
    };
})());

addTabHandler((async function () {
    const $appVersion = $("#app-version");
    const $dbVersion = $("#db-version");
    const $syncVersion = $("#sync-version");
    const $buildDate = $("#build-date");
    const $buildRevision = $("#build-revision");

    const appInfo = await server.get('app-info');

    $appVersion.html(appInfo.appVersion);
    $dbVersion.html(appInfo.dbVersion);
    $syncVersion.html(appInfo.syncVersion);
    $buildDate.html(appInfo.buildDate);
    $buildRevision.html(appInfo.buildRevision);
    $buildRevision.attr('href', 'https://github.com/zadam/trilium/commit/' + appInfo.buildRevision);

    return {};
})());

addTabHandler((function() {
    const $form = $("#sync-setup-form");
    const $syncServerHost = $("#sync-server-host");
    const $syncServerTimeout = $("#sync-server-timeout");
    const $syncProxy = $("#sync-proxy");
    const $testSyncButton = $("#test-sync-button");

    function optionsLoaded(options) {
        $syncServerHost.val(options['syncServerHost']);
        $syncServerTimeout.val(options['syncServerTimeout']);
        $syncProxy.val(options['syncProxy']);
    }

    $form.submit(() => {
        saveOptions({
            'syncServerHost': $syncServerHost.val(),
            'syncServerTimeout': $syncServerTimeout.val(),
            'syncProxy': $syncProxy.val()
        });

        return false;
    });

    $testSyncButton.click(async () => {
        const result = await server.post('sync/test');

        if (result.success) {
            infoService.showMessage(result.message);
        }
        else {
            infoService.showError("Sync server handshake failed, error: " + result.message);
        }
    });

    return {
        optionsLoaded
    };
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