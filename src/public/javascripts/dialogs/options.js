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
    const $mainFontSize = $("#main-font-size");
    const $treeFontSize = $("#tree-font-size");
    const $detailFontSize = $("#detail-font-size");
    const $body = $("body");
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

        $mainFontSize.val(options.mainFontSize);
        $treeFontSize.val(options.treeFontSize);
        $detailFontSize.val(options.detailFontSize);
    }

    $themeSelect.change(function() {
        const newTheme = $(this).val();

        for (const clazz of $body[0].classList) {
            if (clazz.startsWith("theme-")) {
                $body.removeClass(clazz);
            }
        }

        $body.addClass("theme-" + newTheme);

        server.put('options/theme/' + newTheme);
    });

    $zoomFactorSelect.change(function() { zoomService.setZoomFactorAndSave($(this).val()); });

    function resizeLeftPanel() {
        const leftPanePercent = parseInt($leftPaneWidthPercent.val());
        const rightPanePercent = 100 - leftPanePercent;
        const leftPaneMinWidth = $leftPaneMinWidth.val();

        $container.css("grid-template-columns", `minmax(${leftPaneMinWidth}px, ${leftPanePercent}fr) ${rightPanePercent}fr`);
    }

    $leftPaneMinWidth.change(async function() {
        await server.put('options/leftPaneMinWidth/' + $(this).val());

        resizeLeftPanel();
    });

    $leftPaneWidthPercent.change(async function() {
        await server.put('options/leftPaneWidthPercent/' + $(this).val());

        resizeLeftPanel();
    });

    function applyFontSizes() {
        console.log($mainFontSize.val() + "% !important");

        $body.get(0).style.setProperty("--main-font-size", $mainFontSize.val() + "%");
        $body.get(0).style.setProperty("--tree-font-size", $treeFontSize.val() + "%");
        $body.get(0).style.setProperty("--detail-font-size", $detailFontSize.val() + "%");
    }

    $mainFontSize.change(async function() {
        await server.put('options/mainFontSize/' + $(this).val());

        applyFontSizes();
    });

    $treeFontSize.change(async function() {
        await server.put('options/treeFontSize/' + $(this).val());

        applyFontSizes();
    });

    $detailFontSize.change(async function() {
        await server.put('options/detailFontSize/' + $(this).val());

        applyFontSizes();
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
    const $dataDirectory = $("#data-directory");

    const appInfo = await server.get('app-info');

    $appVersion.text(appInfo.appVersion);
    $dbVersion.text(appInfo.dbVersion);
    $syncVersion.text(appInfo.syncVersion);
    $buildDate.text(appInfo.buildDate);
    $buildRevision.text(appInfo.buildRevision);
    $buildRevision.attr('href', 'https://github.com/zadam/trilium/commit/' + appInfo.buildRevision);
    $dataDirectory.text(appInfo.dataDirectory);

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