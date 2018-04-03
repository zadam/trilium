import server from './services/server.js';

$(document).ready(() => {
    server.get('migration').then(result => {
        const appDbVersion = result.app_dbVersion;
        const dbVersion = result.dbVersion;

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

    const result = await server.post('migration');

    for (const migration of result.migrations) {
        const row = $('<tr>')
            .append($('<td>').html(migration.dbVersion))
            .append($('<td>').html(migration.name))
            .append($('<td>').html(migration.success ? 'Yes' : 'No'))
            .append($('<td>').html(migration.success ? 'N/A' : migration.error));

        if (!migration.success) {
            row.addClass("danger");
        }

        $("#migration-table").append(row);
    }
});