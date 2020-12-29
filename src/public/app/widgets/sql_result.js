import TabAwareWidget from "./tab_aware_widget.js";
import treeService from "../services/tree.js";
import linkService from "../services/link.js";
import hoistedNoteService from "../services/hoisted_note.js";
import server from "../services/server.js";
import toastService from "../services/toast.js";

const TPL = `
<div class="sql-result-widget">
    <style>
    .sql-result-widget {
        padding: 15px;
    }
    </style>
   
    <div class="sql-console-result-container"></div>
</div>`;

export default class SqlResultWidget extends TabAwareWidget {
    isEnabled() {
        return this.note
            && this.note.mime === 'text/x-sqlite;schema=trilium'
            && super.isEnabled();
    }

    doRender() {
        this.$widget = $(TPL);
        this.overflowing();

        this.$sqlConsoleResultContainer = this.$widget.find('.sql-console-result-container');
    }

    async sqlQueryResultsEvent({results}) {
        this.$sqlConsoleResultContainer.empty();

        for (const rows of results) {
            if (rows.length === 0) {
                continue;
            }

            const $table = $('<table class="table table-striped">');
            this.$sqlConsoleResultContainer.append($table);

            const result = rows[0];
            const $row = $("<tr>");

            for (const key in result) {
                $row.append($("<th>").html(key));
            }

            $table.append($row);

            for (const result of rows) {
                const $row = $("<tr>");

                for (const key in result) {
                    $row.append($("<td>").html(result[key]));
                }

                $table.append($row);
            }
        }
    }
}
