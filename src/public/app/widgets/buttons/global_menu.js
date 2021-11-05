import BasicWidget from "../basic_widget.js";
import utils from "../../services/utils.js";

const TPL = `
<div class="dropdown global-menu dropright">
    <style>
    .global-menu {
        width: 53px;
        height: 53px;
    }
    
    .global-menu .dropdown-menu {
        width: 20em;
    }
    
    .global-menu-button {
        background-image: url("images/icon-black.png");
        background-repeat: no-repeat;
        background-position: 50% 45%;
        width: 100%;
        height: 100%;
    }
    
    .global-menu-button:hover {
        background-image: url("images/icon-color.png");
    }
    </style>

    <button type="button" data-toggle="dropdown" data-placement="right"
            aria-haspopup="true" aria-expanded="false" 
            class="icon-action global-menu-button" title="Menu"></button>

    <div class="dropdown-menu dropdown-menu-right">
        <a class="dropdown-item options-button" data-trigger-command="showOptions">
            <span class="bx bx-slider"></span>
            Options
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

        <a class="dropdown-item switch-to-mobile-version-button" data-trigger-command="switchToMobileVersion">
            <span class="bx bx-empty"></span>
            Switch to mobile version
        </a>

        <a class="dropdown-item" data-trigger-command="reloadFrontendApp" 
            title="Reload can help with some visual glitches without restarting the whole app.">
            <span class="bx bx-empty"></span>
            Reload frontend
            <kbd data-command="reloadFrontendApp"></kbd>
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
`;

export default class GlobalMenuWidget extends BasicWidget {
    doRender() {
        this.$widget = $(TPL);

        const $button = this.$widget.find(".global-menu-button");
        $button.tooltip({ trigger: "hover" });
        $button.on("click", () => $button.tooltip("hide"));

        this.$widget.find(".show-about-dialog-button").on('click',
            () => import("../../dialogs/about.js").then(d => d.showDialog()));

        const isElectron = utils.isElectron();

        this.$widget.find(".logout-button").toggle(!isElectron);
        this.$widget.find(".open-dev-tools-button").toggle(isElectron);
        this.$widget.find(".switch-to-mobile-version-button").toggle(!isElectron);

        this.$widget.on('click', '.dropdown-item',
            () => this.$widget.find("[data-toggle='dropdown']").dropdown('toggle'));
    }
}
