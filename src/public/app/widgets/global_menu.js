import BasicWidget from "./basic_widget.js";
import utils from "../services/utils.js";
import syncService from "../services/sync.js";

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
        border: none;
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
            <a class="dropdown-item options-button" data-trigger-command="showOptions">
                <span class="bx bx-slider"></span>
                Options
            </a>

            <a class="dropdown-item sync-now-button" title="Trigger sync">
                <span class="bx bx-refresh"></span>
                Sync now (<span id="outstanding-syncs-count">0</span>)
            </a>

            <a class="dropdown-item" data-trigger-command="openNewWindow">
                <span class="bx bx-window-open"></span>
                Open new window
                <kbd data-command="openNewWindow"></kbd>
            </a>

            <a class="dropdown-item open-dev-tools-button" data-trigger-command="openDevTools">
                <span class="bx bx-terminal"></span>
                Open Dev Tools
                <kbd data-command="openDevTools"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="showSQLConsole">
                <span class="bx bx-data"></span>
                Open SQL Console
                <kbd data-command="showSQLConsole"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="showBackendLog">
                <span class="bx bx-empty"></span>
                Show backend log
                <kbd data-command="showBackendLog"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="reloadFrontendApp" 
                title="Reload can help with some visual glitches without restarting the whole app.">
                <span class="bx bx-empty"></span>
                Reload frontend
                <kbd data-command="reloadFrontendApp"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="toggleZenMode">
                <span class="bx bx-empty"></span>
                Toggle Zen mode
                <kbd data-command="toggleZenMode"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="toggleFullscreen">
                <span class="bx bx-empty"></span>
                Toggle fullscreen
                <kbd data-command="toggleFullscreen"></kbd>
            </a>

            <a class="dropdown-item" data-trigger-command="showHelp">
                <span class="bx bx-info-circle"></span>
                Show Help
                <kbd data-command="showHelp"></kbd>
            </a>

            <a class="dropdown-item show-about-dialog-button">
                <span class="bx bx-empty"></span>
                About Trilium Notes
            </a>

            <a class="dropdown-item logout-button" data-trigger-command="logout">
                <span class="bx bx-log-out"></span>
                Logout
            </a>
        </div>
    </div>
</div>
`;

export default class GlobalMenuWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        this.$widget.find(".show-about-dialog-button").on('click',
            () => import("../dialogs/about.js").then(d => d.showDialog()));

        this.$widget.find(".sync-now-button").on('click', () => syncService.syncNow());

        this.$widget.find(".logout-button").toggle(!utils.isElectron());

        this.$widget.find(".open-dev-tools-button").toggle(utils.isElectron());

        return this.$widget;
    }
}
