"use strict";

$(document).ready(() => {
    $.get(baseApiUrl + 'migration').then(result => {
        const appDbVersion = result.app_db_version;
        const dbVersion = result.db_version;

        if (appDbVersion === dbVersion) {
            $("#up-to-date").show();
        }
        else {
            $("#need-to-migrate").show();

            $("#app-db-version").html(appDbVersion);
            $("#db-version").html(dbVersion);
        }
    });
});

$("#run-migration").click(async () => {
    $("#run-migration").prop("disabled", true);

    $("#migration-result").show();

    const result = await $.ajax({
        url: baseApiUrl + 'migration',
        type: 'POST',
        error: () => showError("Migration failed with unknown error")
    });

    for (const migration of result.migrations) {
        const row = $('<tr>')
            .append($('<td>').html(migration.db_version))
            .append($('<td>').html(migration.name))
            .append($('<td>').html(migration.success ? 'Yes' : 'No'))
            .append($('<td>').html(migration.success ? 'N/A' : migration.error));

        if (!migration.success) {
            row.addClass("danger");
        }

        $("#migration-table").append(row);
    }
});