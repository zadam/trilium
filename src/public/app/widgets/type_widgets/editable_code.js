import libraryLoader from "../../services/library_loader.js";
import TypeWidget from "./type_widget.js";
import keyboardActionService from "../../services/keyboard_actions.js";
import server from "../../services/server.js";
import toastService from "../../services/toast.js";
import utils from "../../services/utils.js";

const TPL = `
<div class="note-detail-code note-detail-printable">
    <style>
    .note-detail-code {
        overflow: auto;
        height: 100%;
        display: flex;
        flex-direction: column;
    }
    
    .note-detail-code-editor {
        flex-basis: 200px;
        min-height: 200px;
        flex-grow: 1;
        overflow: auto;
    }
    
    .sql-console-table-schemas button {
        padding: 0.25rem 0.4rem;
        font-size: 0.875rem;
        line-height: 0.5;
        border-radius: 0.2rem;
    }
    
    .sql-console-result-wrapper {
        flex-grow: 100;
        display: flex;
        flex-direction: column;
        min-height: 0;
    }
    
    .sql-console-result-container {
        width: 100%; 
        font-size: smaller; 
        margin-top: 10px;
        flex-grow: 1;
        overflow: auto;
        min-height: 0;
    }
    
    .table-schema td {
        padding: 5px;
    }
    </style>

    <div class="sql-console-area">
        Tables:
        <span class="sql-console-table-schemas"></span>
    </div>

    <div class="note-detail-code-editor"></div>
    
    <div class="sql-console-area sql-console-result-wrapper">
        <div style="text-align: center">
            <button class="btn btn-danger sql-console-execute">Execute query <kbd>Ctrl+Enter</kbd></button>
        </div>

        <div class="sql-console-result-container"></div>
    </div>
</div>`;

let TABLE_SCHEMA;

export default class EditableCodeTypeWidget extends TypeWidget {
    static getType() { return "editable-code"; }

    doRender() {
        this.$widget = $(TPL);
        this.contentSized();
        this.$editor = this.$widget.find('.note-detail-code-editor');
        this.$sqlConsoleArea = this.$widget.find('.sql-console-area');
        this.$sqlConsoleTableSchemas = this.$widget.find('.sql-console-table-schemas');
        this.$sqlConsoleExecuteButton = this.$widget.find('.sql-console-execute');
        this.$sqlConsoleResultContainer = this.$widget.find('.sql-console-result-container');

        keyboardActionService.setupActionsForElement('code-detail', this.$widget, this);

        utils.bindElShortcut(this.$editor, 'ctrl+return', () => this.execute());

        this.$sqlConsoleExecuteButton.on('click', () => this.execute());

        this.initialized = this.initEditor();
    }

    async initEditor() {
        await libraryLoader.requireLibrary(libraryLoader.CODE_MIRROR);

        CodeMirror.keyMap.default["Shift-Tab"] = "indentLess";
        CodeMirror.keyMap.default["Tab"] = "indentMore";

        // these conflict with backward/forward navigation shortcuts
        delete CodeMirror.keyMap.default["Alt-Left"];
        delete CodeMirror.keyMap.default["Alt-Right"];

        CodeMirror.modeURL = 'libraries/codemirror/mode/%N/%N.js';

        this.codeEditor = CodeMirror(this.$editor[0], {
            value: "",
            viewportMargin: Infinity,
            indentUnit: 4,
            matchBrackets: true,
            matchTags: {bothTags: true},
            highlightSelectionMatches: {showToken: /\w/, annotateScrollbar: false},
            lint: true,
            gutters: ["CodeMirror-lint-markers"],
            lineNumbers: true,
            tabindex: 300,
            // we linewrap partly also because without it horizontal scrollbar displays only when you scroll
            // all the way to the bottom of the note. With line wrap there's no horizontal scrollbar so no problem
            lineWrapping: true,
            dragDrop: false // with true the editor inlines dropped files which is not what we expect
        });

        this.codeEditor.on('change', () => this.spacedUpdate.scheduleUpdate());
    }

    async doRefresh(note) {
        const noteComplement = await this.tabContext.getNoteComplement();

        await this.spacedUpdate.allowUpdateWithoutChange(() => {
            // CodeMirror breaks pretty badly on null so even though it shouldn't happen (guarded by consistency check)
            // we provide fallback
            this.codeEditor.setValue(noteComplement.content || "");
            this.codeEditor.clearHistory();

            const info = CodeMirror.findModeByMIME(note.mime);

            if (info) {
                this.codeEditor.setOption("mode", info.mime);
                CodeMirror.autoLoadMode(this.codeEditor, info.mode);
            }
        });

        const isSqlConsole = note.mime === 'text/x-sqlite;schema=trilium';

        this.$sqlConsoleArea.toggle(isSqlConsole);

        if (isSqlConsole) {
            await this.showTableSchemas();
        }

        this.show();
    }

    async showTableSchemas() {
        if (!TABLE_SCHEMA) {
            TABLE_SCHEMA = await server.get('sql/schema');
        }

        this.$sqlConsoleTableSchemas.empty();

        for (const table of TABLE_SCHEMA) {
            const $tableLink = $('<button class="btn">').text(table.name);

            const $table = $('<table class="table-schema">');

            for (const column of table.columns) {
                $table.append(
                    $("<tr>")
                        .append($("<td>").text(column.name))
                        .append($("<td>").text(column.type))
                );
            }

            this.$sqlConsoleTableSchemas.append($tableLink).append(" ");

            $tableLink
                .tooltip({
                    html: true,
                    placement: 'bottom',
                    boundary: 'window',
                    title: $table[0].outerHTML,
                    sanitize: false
                })
                .on('click', () => this.codeEditor.setValue("SELECT * FROM " + table.name + " LIMIT 100"));
        }
    }

    async execute() {
        // execute the selected text or the whole content if there's no selection
        let sqlQuery = this.codeEditor.getSelection();

        if (!sqlQuery) {
            sqlQuery = this.codeEditor.getValue();
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

    show() {
        this.$widget.show();

        if (this.codeEditor) { // show can be called before render
            this.codeEditor.refresh();
        }
    }

    getContent() {
        return this.codeEditor.getValue();
    }

    focus() {
        this.codeEditor.focus();
    }

    cleanup() {
        if (this.codeEditor) {
            this.spacedUpdate.allowUpdateWithoutChange(() => {
                this.codeEditor.setValue('');
            });
        }
    }
}
