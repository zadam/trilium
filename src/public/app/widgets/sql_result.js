import NoteContextAwareWidget from "./note_context_aware_widget.js";

const TPL = `
<div class="sql-result-widget">
    <style>
    .sql-result-widget {
        padding: 15px;
    }
    </style>
   
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
        this.overflowing();

        this.$sqlConsoleResultContainer = this.$widget.find('.sql-console-result-container');
    }

    async sqlQueryResultsEvent({ntxId, results}) {
        if (!this.isNoteContext(ntxId)) {
            return;
        }

        this.$sqlConsoleResultContainer.empty();

        for (const rows of results) {
            if (!rows.length) {
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
