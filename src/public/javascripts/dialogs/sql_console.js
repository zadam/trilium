import libraryLoader from '../services/library_loader.js';
import server from '../services/server.js';
import toastService from "../services/toast.js";
import utils from "../services/utils.js";
import keys from "../services/keybindings.js";

const $dialog = $("#sql-console-dialog");
const $query = $('#sql-console-query');
const $executeButton = $('#sql-console-execute');
const $resultHead = $('#sql-console-results thead');
const $resultBody = $('#sql-console-results tbody');
const $tables = $("#sql-console-tables");

let codeEditor;

$dialog.on("shown.bs.modal", e => initEditor());

export async function showDialog() {
    utils.closeActiveDialog();

    glob.activeDialog = $dialog;

    await showTables();

    $dialog.modal();
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

async function showTables() {
    const tables = await server.get('sql/schema');

    $tables.empty();

    for (const table of tables) {
        const $tableLink = $('<button class="btn">').text(table.name);

        const $columns = $("<table>");

        for (const column of table.columns) {
            $columns.append(
                $("<tr>")
                    .append($("<td>").text(column.name))
                    .append($("<td>").text(column.type))
            );
        }

        $tables.append($tableLink).append(" ");

        $tableLink
            .tooltip({html: true, title: $columns.html()})
            .click(() => codeEditor.setValue("SELECT * FROM " + table.name + " LIMIT 100"));
    }
}

keys.bindTo($query, keys.actions.RunSQL, execute);

$executeButton.click(execute);
