"use strict";

const sqlConsole = (function() {
    const dialogEl = $("#sql-console-dialog");
    const queryEl = $('#sql-console-query');
    const executeButton = $('#sql-console-execute');
    const resultHeadEl = $('#sql-console-results thead');
    const resultBodyEl = $('#sql-console-results tbody');

    function showDialog() {
        glob.activeDialog = dialogEl;

        dialogEl.dialog({
            modal: true,
            width: $(window).width(),
            height: $(window).height()
        });
    }

    async function execute() {
        const sqlQuery = queryEl.val();

        const result = await server.post("sql/execute", {
            query: sqlQuery
        });

        if (!result.success) {
            showError(result.error);
            return;
        }

        const rows = result.rows;

        resultHeadEl.empty();
        resultBodyEl.empty();

        if (rows.length > 0) {
            const result = rows[0];
            const rowEl = $("<tr>");

            for (const key in result) {
                rowEl.append($("<th>").html(key));
            }

            resultHeadEl.append(rowEl);
        }

        for (const result of rows) {
            const rowEl = $("<tr>");

            for (const key in result) {
                rowEl.append($("<td>").html(result[key]));
            }

            resultBodyEl.append(rowEl);
        }
    }

    $(document).bind('keydown', 'alt+o', showDialog);

    executeButton.click(execute);

    return {
        showDialog
    };
})();