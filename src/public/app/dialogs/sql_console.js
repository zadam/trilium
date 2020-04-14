import libraryLoader from '../services/library_loader.js';
import server from '../services/server.js';
import toastService from "../services/toast.js";
import utils from "../services/utils.js";

const $dialog = $("#sql-console-dialog");
const $query = $('#sql-console-query');
const $executeButton = $('#sql-console-execute');
const $tableSchemas = $("#sql-console-table-schemas");
const $resultContainer = $("#result-container");

let codeEditor;

$dialog.on("shown.bs.modal", e => initEditor());

export async function showDialog() {
    await showTableSchemas();

    utils.openDialog($dialog);
}

async function initEditor() {
    if (!codeEditor) {
        await libraryLoader.requireLibrary(libraryLoader.CODE_MIRROR);

        CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
        CodeMirror.keyMap.default["Tab"] = "indentMore";

        // removing Escape binding so that Escape will propagate to the dialog (which will close on escape)
        delete CodeMirror.keyMap.basic["Esc"];

        CodeMirror.modeURL = 'libraries/codemirror/mode/%N/%N.js';

        codeEditor = CodeMirror($query[0], {
            value: "",
            viewportMargin: Infinity,
            indentUnit: 4,
            highlightSelectionMatches: {showToken: /\w/, annotateScrollbar: false}
        });

        codeEditor.setOption("mode", "text/x-sqlite");
        CodeMirror.autoLoadMode(codeEditor, "sql");

        codeEditor.setValue(`SELECT title, isProtected, type, mime FROM notes WHERE noteId = 'root';
---
SELECT noteId, parentNoteId, notePosition, prefix FROM branches WHERE branchId = 'root';`);
    }

    codeEditor.focus();
}

async function execute() {
    // execute the selected text or the whole content if there's no selection
    let sqlQuery = codeEditor.getSelection();

    if (!sqlQuery) {
        sqlQuery = codeEditor.getValue();
    }

    const result = await server.post("sql/execute", {
        query: sqlQuery
    });

    if (!result.success) {
        toastService.showError(result.error);
        return;
    }
    else {
        toastService.showMessage("Query was executed successfully.");
    }

    const results = result.results;

    $resultContainer.empty();

    for (const rows of results) {
        if (rows.length === 0) {
            continue;
        }

        const $table = $('<table class="table table-striped">');
        $resultContainer.append($table);

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

async function showTableSchemas() {
    const tables = await server.get('sql/schema');

    $tableSchemas.empty();

    for (const table of tables) {
        const $tableLink = $('<button class="btn">').text(table.name);

        const $columns = $("<ul>");

        for (const column of table.columns) {
            $columns.append(
                $("<li>")
                    .append($("<span>").text(column.name))
                    .append($("<span>").text(column.type))
            );
        }

        $tableSchemas.append($tableLink).append(" ");

        $tableLink
            .tooltip({
                html: true,
                placement: 'bottom',
                boundary: 'window',
                title: $columns[0].outerHTML
            })
            .on('click', () => codeEditor.setValue("SELECT * FROM " + table.name + " LIMIT 100"));
    }
}

utils.bindElShortcut($query, 'ctrl+return', execute);

$executeButton.on('click', execute);
