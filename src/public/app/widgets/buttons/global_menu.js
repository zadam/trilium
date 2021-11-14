import BasicWidget from "../basic_widget.js";
import utils from "../../services/utils.js";
import UpdateAvailableWidget from "./update_available.js";
const axios = require("axios");

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
        
        position: relative;
    }
    
    .global-menu-button:hover {
        background-image: url("images/icon-color.png");
    }
    
    .global-menu-button-update-available {
        position: absolute;
        right: -30px;
        bottom: -30px;
        width: 100%;
        height: 100%;
            
        pointer-events: none;
    }
    </style>

    <button type="button" data-toggle="dropdown" data-placement="right"
            aria-haspopup="true" aria-expanded="false" 
            class="icon-action global-menu-button" title="Menu">
        <div class="global-menu-button-update-available"></div>
    </button>

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

        <a class="dropdown-item show-about-dialog-button">
            <span class="bx bx-sync"></span>
            Update to newest version
        </a>

        <a class="dropdown-item logout-button" data-trigger-command="logout">
            <span class="bx bx-log-out"></span>
            Logout
        </a>
    </div>
</div>
`;
const RELEASES_API_URL = "https://api.github.com/repos/zadam/trilium/releases/latest";
const CURRENT_VERSION = process.env.npm_package_version;

export default class GlobalMenuWidget extends BasicWidget {
    static getVersionChange(oldVersion, newVersion) {
        const [oldMajor, oldMinor, oldPatch] = oldVersion.split(".").map(Number);
        const [newMajor, newMinor, newPatch] = newVersion.split(".").map(Number);

        if (newMajor !== oldMajor) {
            return "major";
        } else if (newMinor !== oldMinor) {
            return "minor";
        } else if (newPatch !== oldPatch) {
            return "patch";
        }
    }

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

        this.loadUpdateAvailable();
    }

    async loadUpdateAvailable() {
        const newVersion = await this.fetchNewVersion();

        if (!newVersion) {
            return;
        }

        const versionChange = "major";

        this.$widget.find(".global-menu-button-update-available").append(
            new UpdateAvailableWidget()
                .withVersionChange(versionChange)
                .render()
        )
    }

    async fetchNewVersion() {
        const {data} = await axios.get(RELEASES_API_URL);

        return data.tag_name.substring(1);
    }
}
