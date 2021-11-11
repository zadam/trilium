const axios = require("axios");
import BasicWidget from "../basic_widget.js";

const TPL = `
    <div>
        <style>
            .global-menu-button-update-available-button {
                width: 21px !important;
                height: 21px !important;
                padding: 0 !important;
                
                border-radius: 8px;
                transform: scale(0.9);
                border: none;
                opacity: 0.5;
                
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .global-menu-button-wrapper:hover .global-menu-button-update-available-button {
                opacity: 1;
            }
        </style>
        <span class="bx bx-sync global-menu-button-update-available-button" title="Update available"></span>
    </div>
`
const VERSION_CHANGE_COLOR_MAP = {
    minor: "#666666",
    "semi-major": "#5bc625",
    major: "#ec2f2f"
}
const VERSION_CHANGE_BACKGROUND_COLOR_MAP = Object.fromEntries(
    Object.entries(
        VERSION_CHANGE_COLOR_MAP).map(([key, value]) => [
            key,
            `${value}40`
        ]
    )
)
const RELEASES_API_URL = "https://api.github.com/repos/zadam/trilium/releases/latest";
const CURRENT_VERSION = process.env.npm_package_version;

export default class UpdateAvailableWidget extends BasicWidget {
    static getVersionChange(oldVersion, newVersion) {
        const [oldMajor, oldSemiMajor, oldMinor] = oldVersion.split(".").map(Number);
        const [newMajor, newSemiMajor, newMinor] = newVersion.split(".").map(Number);

        if (newMajor !== oldMajor) {
            return "major";
        } else if (newSemiMajor !== oldSemiMajor) {
            return "semi-major";
        } else if (newMinor !== oldMinor) {
            return "minor";
        }
    }

    async fetchNewVersion() {
        const {data} = await axios.get(RELEASES_API_URL);

        return data.tag_name.substring(1);
    }

    async checkVersion() {
        const newVersion = await this.fetchNewVersion();
        const versionChange = UpdateAvailableWidget.getVersionChange(CURRENT_VERSION, newVersion);

        console.log(`Checking versions: ${CURRENT_VERSION} -> ${newVersion}`)

        this.setButton(versionChange);
    }

    doRender() {
        this.$widget = $(TPL);

        this.checkVersion();
        this.setButton(undefined);
    }

    setButton(versionChange) {
        const $icon = this.$widget.find(".global-menu-button-update-available-button");

        switch (versionChange) {
            case "major":
            case "semi-major":
            case "minor":
                $icon.show();
                $icon.css({
                    color: VERSION_CHANGE_COLOR_MAP[versionChange],
                    backgroundColor: VERSION_CHANGE_BACKGROUND_COLOR_MAP[versionChange]
                });
                break;
            default:
                $icon.hide();
        }
    }
}
