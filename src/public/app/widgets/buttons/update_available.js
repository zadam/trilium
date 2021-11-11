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

export default class UpdateAvailableWidget extends BasicWidget {
    versionChange = undefined

    doRender() {
        this.$widget = $(TPL);

        this.setButton();
    }

    setButton() {
        switch (this.versionChange) {
            case "major":
            case "semi-major":
            case "minor":
                this.$widget.show();
                this.$widget.css({
                    color: VERSION_CHANGE_COLOR_MAP[this.versionChange],
                    backgroundColor: VERSION_CHANGE_BACKGROUND_COLOR_MAP[this.versionChange]
                });
                break;
            default:
                this.$widget.hide();
        }
    }

    withVersionChange(versionChange) {
        this.versionChange = versionChange;

        return this;
    }
}
