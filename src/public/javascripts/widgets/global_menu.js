import BasicWidget from "./basic_widget.js";
import keyboardActionService from "../services/keyboard_actions.js";
import utils from "../services/utils.js";
import syncService from "../services/sync.js";

const OPTIONS = "../dialogs/options.js";
const SQL_CONSOLE = "../dialogs/sql_console.js";
const BACKEND_LOG = "../dialogs/backend_log.js";
const HELP = "../dialogs/help.js";
const ABOUT = "../dialogs/about.js";

const TPL = `
<div class="global-menu-wrapper">
    <style>
    .global-menu-wrapper {
        height: 35px;
        border-bottom: 1px solid var(--main-border-color);
    }
    
    .global-menu button {
        margin-right: 10px;
        height: 33px;
        border-bottom: none;
    }
    
    .global-menu .dropdown-menu {
        width: 20em;
    }
    </style>

    <div class="dropdown global-menu">
        <button type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false" class="btn btn-sm dropdown-toggle">
            <span class="bx bx-menu"></span>
            Menu
            <span class="caret"></span>
        </button>
        <div class="dropdown-menu dropdown-menu-right">
            <a class="dropdown-item options-button">
                <span class="bx bx-slider"></span>
                Options
            </a>

            <a class="dropdown-item sync-now-button" title="Trigger sync">
                <span class="bx bx-recycle"></span>
                Sync (<span id="outstanding-syncs-count">0</span>)
            </a>

            <a class="dropdown-item open-dev-tools-button">
                <span class="bx bx-terminal"></span>
                Open Dev Tools
                <kbd data-kb-action="OpenDevTools"></kbd>
            </a>

            <a class="dropdown-item open-sql-console-button">
                <span class="bx bx-data"></span>
                Open SQL Console
                <kbd data-kb-action="ShowSQLConsole"></kbd>
            </a>

            <a class="dropdown-item show-backend-log-button">
                <span class="bx bx-empty"></span>
                Show backend log
                <kbd data-kb-action="ShowBackendLog"></kbd>
            </a>

            <a class="dropdown-item reload-frontend-button" title="Reload can help with some visual glitches without restarting the whole app.">
                <span class="bx bx-empty"></span>
                Reload frontend
                <kbd data-kb-action="ReloadFrontendApp"></kbd>
            </a>

            <a class="dropdown-item toggle-zen-mode-button">
                <span class="bx bx-empty"></span>
                Toggle Zen mode
                <kbd data-kb-action="ToggleZenMode"></kbd>
            </a>

            <a class="dropdown-item toggle-fullscreen-button">
                <span class="bx bx-empty"></span>
                Toggle fullscreen
                <kbd data-kb-action="ToggleFullscreen"></kbd>
            </a>

            <a class="dropdown-item show-help-button">
                <span class="bx bx-info-circle"></span>
                Show Help
                <kbd data-kb-action="ShowHelp"></kbd>
            </a>

            <a class="dropdown-item show-about-dialog-button">
                <span class="bx bx-empty"></span>
                About Trilium Notes
            </a>

            <a class="dropdown-item logout-button">
                <span class="bx bx-log-out"></span>
                Logout
            </a>
        </div>
    </div>
</div>
`;

export default class GlobalMenuWidget extends BasicWidget {
    render() {
        this.$widget = $(TPL);

        let zenModeActive = false;

        // hide (toggle) everything except for the note content for zen mode
        const toggleZenMode = () => {
            if (!zenModeActive) {
                $(".hide-in-zen-mode,.gutter").addClass("hidden-by-zen-mode");
                $("#container").addClass("zen-mode");
                zenModeActive = true;
            }
            else {
                // not hiding / showing explicitly since element might be hidden also for other reasons
                $(".hide-in-zen-mode,.gutter").removeClass("hidden-by-zen-mode");
                $("#container").removeClass("zen-mode");
                zenModeActive = false;
            }
        };

        this.$widget.find(".toggle-zen-mode-button").on('click', toggleZenMode);
        keyboardActionService.setGlobalActionHandler("ToggleZenMode", toggleZenMode);

        this.$widget.find(".reload-frontend-button").on('click', utils.reloadApp);
        keyboardActionService.setGlobalActionHandler("ReloadFrontendApp", utils.reloadApp);

        this.$widget.find(".open-dev-tools-button").toggle(utils.isElectron());

        const showOptionsDialog = () => import(OPTIONS).then(d => d.showDialog());
        this.$widget.find(".options-button").on('click', showOptionsDialog);
        keyboardActionService.setGlobalActionHandler("ShowOptions", showOptionsDialog);

        const showHelpDialog = () => import(HELP).then(d => d.showDialog());
        this.$widget.find(".show-help-button").on('click', showHelpDialog);
        keyboardActionService.setGlobalActionHandler("ShowHelp", showHelpDialog);

        const showSqlConsoleDialog = () => import(SQL_CONSOLE).then(d => d.showDialog());
        this.$widget.find(".open-sql-console-button").on('click', showSqlConsoleDialog);
        keyboardActionService.setGlobalActionHandler("ShowSQLConsole", showSqlConsoleDialog);

        const showBackendLogDialog = () => import(BACKEND_LOG).then(d => d.showDialog());
        this.$widget.find(".show-backend-log-button").on('click', showBackendLogDialog);
        keyboardActionService.setGlobalActionHandler("ShowBackendLog", showBackendLogDialog);

        this.$widget.find(".show-about-dialog-button").on('click', () => import(ABOUT).then(d => d.showDialog()));

        this.$widget.find(".sync-now-button").on('click', () => syncService.syncNow());

        if (utils.isElectron()) {
            const toggleFullscreen = () => {
                const win = require('electron').remote.getCurrentWindow();

                if (win.isFullScreenable()) {
                    win.setFullScreen(!win.isFullScreen());
                }

                return false;
            };

            this.$widget.find(".toggle-fullscreen-button").on('click', toggleFullscreen);

            keyboardActionService.setGlobalActionHandler("ToggleFullscreen", toggleFullscreen);
        }
        else {
            // outside of electron this is handled by the browser
            this.$widget.find(".toggle-fullscreen-button").hide();
        }

        this.$widget.find(".logout-button")
            .toggle(!utils.isElectron())
            .on('click', () => {
            const $logoutForm = $('<form action="logout" method="POST">')
                .append($(`<input type="hidden" name="_csrf" value="${glob.csrfToken}"/>`));

            $("body").append($logoutForm);
            $logoutForm.trigger('submit');
        });

        return this.$widget;
    }
}