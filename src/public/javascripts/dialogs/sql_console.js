"use strict";

const sqlConsole = (function() {
    const $dialog = $("#sql-console-dialog");
    const $query = $('#sql-console-query');
    const $executeButton = $('#sql-console-execute');
    const $resultHead = $('#sql-console-results thead');
    const $resultBody = $('#sql-console-results tbody');

    function showDialog() {
        glob.activeDialog = $dialog;

        $dialog.dialog({
            modal: true,
            width: $(window).width(),
            height: $(window).height()
        });
    }

    async function execute() {
        const sqlQuery = $query.val();

        const result = await server.post("sql/execute", {
            query: sqlQuery
        });

        if (!result.success) {
            showError(result.error);
            return;
        }
        else {
            showMessage("Query was executed successfully.");
        }

        const rows = result.rows;

        $resultHead.empty();
        $resultBody.empty();

        if (rows.length > 0) {
            const result = rows[0];
            const rowEl = $("<tr>");

            for (const key in result) {
                rowEl.append($("<th>").html(key));
            }

            $resultHead.append(rowEl);
        }

        for (const result of rows) {
            const rowEl = $("<tr>");

            for (const key in result) {
                rowEl.append($("<td>").html(result[key]));
            }

            $resultBody.append(rowEl);
        }
    }

    $(document).bind('keydown', 'alt+o', showDialog);

    $query.bind('keydown', 'ctrl+return', execute);

    $executeButton.click(execute);

    return {
        showDialog
    };
})();