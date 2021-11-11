import BasicWidget from "../basic_widget.js";

const TPL = `
    <button type="button" data-toggle="dropdown" data-placement="right"
        aria-haspopup="true" aria-expanded="false" 
        class="icon-action bx bx-sync global-menu-button-update-available-button" title="Update available"></button>
`
const VERSION_CHANGE_COLOR_MAP = {
    minor: "#666",
    "semi-minor": "#5bc625",
    major: "#ec2f2f"
}

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

    doRender() {
        this.$widget = $(TPL);
    }

    setButtonColor(versionChange) {
        switch (versionChange) {
            case "major":
                this.$
        }
    }
}
