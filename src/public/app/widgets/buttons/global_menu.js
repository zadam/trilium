import BasicWidget from "../basic_widget.js";
import utils from "../../services/utils.js";
import UpdateAvailableWidget from "./update_available.js";
import options from "../../services/options.js";

const TPL = `
<div class="dropdown global-menu dropright">
    <style>
    .global-menu {
        width: 53px;
        height: 53px;
    }
    
    .global-menu .dropdown-menu {
        min-width: 20em;
    }
    
    .global-menu-button {
        background-image: url("${window.glob.assetPath}/images/icon-black.svg");
        background-repeat: no-repeat;
        background-position: 40% 50%;
        background-size: 45px;
        width: 100%;
        height: 100%;
        position: relative;
    }
    
    .global-menu-button:hover {
        background-image: url("${window.glob.assetPath}/images/icon-color.svg");
        border: 0;
    }
    
    .global-menu-button-update-available {
        position: absolute;
        right: -30px;
        bottom: -30px;
        width: 100%;
        height: 100%;
        pointer-events: none;
    }

    .update-to-latest-version-button {
        display: none;
    }
    
    .global-menu .zoom-container {
        display: flex; 
        flex-direction: row; 
        justify-content: space-between;
        align-items: baseline;
    }
    
    .global-menu .zoom-buttons a {
        display: inline-block;
        border: 1px solid var(--button-border-color);
        border-radius: var(--button-border-radius);
        color: var(--button-text-color);
        background-color: var(--button-background-color);
        padding: 3px;
        margin-left: 3px;
    }
    
    .global-menu .zoom-buttons a:hover {
        text-decoration: none;
    }
    
    .global-menu .zoom-state {
        margin-left: 5px;
        margin-right: 5px;
    }
    
    .global-menu .dropdown-item .bx {
        position: relative;
        top: 3px;
        font-size: 120%;
        margin-right: 5px;
    }
    
    body.mobile .show-help-button, body.mobile .show-about-dialog-button {
        /* hidden because these dialogs are not available for mobile */
        display: none;
    }
    
    body.mobile .global-menu .dropdown-submenu .dropdown-menu {
        display: block;
        font-size: 90%;
        position: relative;
        left: 0;
        top: 5px;
    }
    </style>

    <button type="button" data-toggle="dropdown" data-placement="right"
            aria-haspopup="true" aria-expanded="false" 
            class="icon-action global-menu-button" title="Menu">
        <div class="global-menu-button-update-available"></div>
    </button>

    <ul class="dropdown-menu dropdown-menu-right">
        <li class="dropdown-item" data-trigger-command="showOptions">
            <span class="bx bx-slider"></span>
            Options
        </li>

        <li class="dropdown-item" data-trigger-command="openNewWindow">
            <span class="bx bx-window-open"></span>
            Open New Window
            <kbd data-command="openNewWindow"></kbd>
        </li>

        <li class="dropdown-item switch-to-mobile-version-button" data-trigger-command="switchToMobileVersion">
            <span class="bx bx-mobile"></span>
            Switch to Mobile Version
        </li>
        
        <li class="dropdown-item switch-to-desktop-version-button" data-trigger-command="switchToDesktopVersion">
            <span class="bx bx-desktop"></span>
            Switch to Desktop Version
        </li>
        
        <span class="zoom-container dropdown-item">
            <div>
                <span class="bx bx-empty"></span>
                Zoom
            </div>
            
            <div class="zoom-buttons">
                <a data-trigger-command="toggleFullscreen" title="Toggle Fullscreen" class="bx bx-expand-alt"></a>
                
                &nbsp;
                
                <a data-trigger-command="zoomOut" title="Zoom Out" class="bx bx-minus"></a>
                
                <span data-trigger-command="zoomReset" title="Reset Zoom Level" class="zoom-state"></span>
                
                <a data-trigger-command="zoomIn" title="Zoom In" class="bx bx-plus"></a>
            </div>
        </span>

        <li class="dropdown-item" data-trigger-command="showLaunchBarSubtree">
            <span class="bx bx-sidebar"></span>
            Configure Launchbar
        </li>
        
        <li class="dropdown-item" data-trigger-command="showShareSubtree">
            <span class="bx bx-share-alt"></span>
            Show Shared Notes Subtree
        </li>
        
        <li class="dropdown-item dropdown-submenu">
            <span class="dropdown-toggle">
                <span class="bx bx-empty"></span>
                Advanced
            </span>
            
            <ul class="dropdown-menu">
                <li class="dropdown-item open-dev-tools-button" data-trigger-command="openDevTools">
                    <span class="bx bx-bug-alt"></span>
                    Open Dev Tools
                    <kbd data-command="openDevTools"></kbd>
                </li>
        
                <li class="dropdown-item" data-trigger-command="showSQLConsole">
                    <span class="bx bx-data"></span>
                    Open SQL Console
                    <kbd data-command="showSQLConsole"></kbd>
                </li>
                
                <li class="dropdown-item" data-trigger-command="showSQLConsoleHistory">
                    <span class="bx bx-empty"></span>
                    Open SQL Console History
                </li>
                
                <li class="dropdown-item" data-trigger-command="showSearchHistory">
                    <span class="bx bx-empty"></span>
                    Open Search History
                </li>
        
                <li class="dropdown-item" data-trigger-command="showBackendLog">
                    <span class="bx bx-empty"></span>
                    Show Backend Log
                    <kbd data-command="showBackendLog"></kbd>
                </li>
                
                <li class="dropdown-item" data-trigger-command="reloadFrontendApp" 
                    title="Reload can help with some visual glitches without restarting the whole app.">
                    <span class="bx bx-empty"></span>
                    Reload Frontend
                    <kbd data-command="reloadFrontendApp"></kbd>
                </li>
                
                <li class="dropdown-item" data-trigger-command="showHiddenSubtree">
                    <span class="bx bx-empty"></span>
                    Show Hidden Subtree
                </li>
            </ul>
        </li>

        <li class="dropdown-item show-help-button" data-trigger-command="showHelp">
            <span class="bx bx-info-circle"></span>
            Show Help
            <kbd data-command="showHelp"></kbd>
        </li>

        <li class="dropdown-item show-about-dialog-button">
            <span class="bx bx-empty"></span>
            About Trilium Notes
        </li>

        <li class="dropdown-item update-to-latest-version-button" data-trigger-command="downloadLatestVersion">
            <span class="bx bx-sync"></span>

            <span class="version-text"></span>
        </li>

        <li class="dropdown-item logout-button" data-trigger-command="logout">
            <span class="bx bx-log-out"></span>
            Logout
        </li>
    </ul>
</div>
`;

export default class GlobalMenuWidget extends BasicWidget {
    constructor() {
        super();

        this.updateAvailableWidget = new UpdateAvailableWidget();
    }

    doRender() {
        this.$widget = $(TPL);

        this.$dropdown = this.$widget.find("[data-toggle='dropdown']");
        const $button = this.$widget.find(".global-menu-button");
        $button.tooltip({ trigger: "hover" });
        $button.on("click", () => $button.tooltip("hide"));

        this.$widget.find(".show-about-dialog-button").on('click', () => this.triggerCommand("openAboutDialog"));

        const isElectron = utils.isElectron();

        this.$widget.find(".logout-button").toggle(!isElectron);
        this.$widget.find(".open-dev-tools-button").toggle(isElectron);
        this.$widget.find(".switch-to-mobile-version-button").toggle(!isElectron && utils.isDesktop());
        this.$widget.find(".switch-to-desktop-version-button").toggle(!isElectron && utils.isMobile());

        this.$widget.on('click', '.dropdown-item', e => {
            if ($(e.target).parent(".zoom-buttons")) {
                return;
            }

            this.$dropdown.dropdown('toggle');
        });

        this.$widget.find(".global-menu-button-update-available").append(
            this.updateAvailableWidget.render()
        );

        this.$updateToLatestVersionButton = this.$widget.find(".update-to-latest-version-button");

        if (!utils.isElectron()) {
            this.$widget.find(".zoom-container").hide();
        }

        this.$zoomState = this.$widget.find(".zoom-state");
        this.$widget.on('show.bs.dropdown', () => this.updateZoomState());

        this.$widget.find(".zoom-buttons").on("click",
            // delay to wait for the actual zoom change
            () => setTimeout(() => this.updateZoomState(), 300)
        );

        this.updateVersionStatus();

        setInterval(() => this.updateVersionStatus(), 8 * 60 * 60 * 1000);
    }

    updateZoomState() {
        if (!utils.isElectron()) {
            return;
        }

        const zoomFactor = utils.dynamicRequire('electron').webFrame.getZoomFactor();
        const zoomPercent = Math.round(zoomFactor * 100);

        this.$zoomState.text(`${zoomPercent}%`);
    }

    async updateVersionStatus() {
        await options.initializedPromise;

        if (options.get("checkForUpdates") !== 'true') {
            return;
        }

        const latestVersion = await this.fetchLatestVersion();
        this.updateAvailableWidget.updateVersionStatus(latestVersion);
        this.$updateToLatestVersionButton.toggle(latestVersion > glob.triliumVersion);
        this.$updateToLatestVersionButton.find(".version-text").text(`Version ${latestVersion} is available, click to download.`);
    }

    async fetchLatestVersion() {
        const RELEASES_API_URL = "https://api.github.com/repos/zadam/trilium/releases/latest";

        const resp = await fetch(RELEASES_API_URL);
        const data = await resp.json();

        return data?.tag_name?.substring(1);
    }

    downloadLatestVersionCommand() {
        window.open("https://github.com/zadam/trilium/releases/latest");
    }

    activeContextChangedEvent() {
        this.$dropdown.dropdown('hide');
    }

    noteSwitchedEvent() {
        this.$dropdown.dropdown('hide');
    }
}
