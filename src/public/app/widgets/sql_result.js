import NoteContextAwareWidget from "./note_context_aware_widget.js";

const TPL = `
<div class="sql-result-widget">
    <style>
    .sql-result-widget {
        padding: 15px;
    }
    </style>
   
    <div class="sql-query-no-rows alert alert-info" style="display: none;">
        No rows have been returned for this query.
    </div>
   
    <div class="sql-console-result-container"></div>
</div>`;

export default class SqlResultWidget extends NoteContextAwareWidget {
    isEnabled() {
        return this.note
            && this.note.mime === 'text/x-sqlite;schema=trilium'
            && super.isEnabled();
    }

    doRender() {
        this.$widget = $(TPL);

        this.$resultContainer = this.$widget.find('.sql-console-result-container');
        this.$noRowsAlert = this.$widget.find('.sql-query-no-rows');
    }

    async sqlQueryResultsEvent({ntxId, results}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        this.$noRowsAlert.toggle(results.length === 1 && results[0].length === 0);
        this.$resultContainer.toggle(results.length > 1 || results[0].length > 0);

        this.$resultContainer.empty();

        for (const rows of results) {
            if (typeof rows === 'object' && !Array.isArray(rows)) {
                // inserts, updates
                this.$resultContainer.empty().show().append(
                    $("<pre>").text(JSON.stringify(rows, null, '\t'))
                );

                continue;
            }

            if (!rows.length) {
                continue;
            }

            const $table = $('<table class="table table-striped">');
            this.$resultContainer.append($table);

            const result = rows[0];
            const $row = $("<tr>");

            for (const key in result) {
                $row.append($("<th>").text(key));
            }

            $table.append($row);

            for (const result of rows) {
                const $row = $("<tr>");

                for (const key in result) {
                    $row.append($("<td>").text(result[key]));
                }

                $table.append($row);
            }
        }
    }
}
