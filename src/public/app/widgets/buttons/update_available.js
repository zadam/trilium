const axios = require("axios");
import BasicWidget from "../basic_widget.js";

const TPL = `
    <span class="bx bx-sync global-menu-button-update-available-button" title="Update available"></span>
    <style>
        .global-menu-button-update-available-button {
            width: 21px !important;
            height: 21px !important;
            padding: 0 !important;
            
            border-radius: 8px;
            transform: scale(0.9);
            border: none;
            opacity: 0.8;
            
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .global-menu-button-wrapper:hover .global-menu-button-update-available-button {
            opacity: 1;
        }
    </style>
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
const CURRENT_VERSION = process.env.npm_package_version;

export default class UpdateAvailableWidget extends BasicWidget {
    newVersion = undefined

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

    checkVersion() {
        console.log(`New version available: ${CURRENT_VERSION} -> ${this.newVersion}`)
        const versionChange = UpdateAvailableWidget.getVersionChange(CURRENT_VERSION, this.newVersion);

        this.setButton(versionChange);
    }

    doRender() {
        this.$widget = $(TPL);

        this.checkVersion();
    }

    setButton(versionChange) {
        switch (versionChange) {
            case "major":
            case "semi-major":
            case "minor":
                this.$widget.show();
                this.$widget.css({
                    color: VERSION_CHANGE_COLOR_MAP[versionChange],
                    backgroundColor: VERSION_CHANGE_BACKGROUND_COLOR_MAP[versionChange]
                });
                break;
            default:
                this.$widget.hide();
        }
    }

    version(newVersion) {
        this.newVersion = newVersion;

        return this;
    }
}
