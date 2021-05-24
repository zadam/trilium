import ButtonWidget from "./button_widget.js";
import options from "../../services/options.js";
import splitService from "../../services/split.js";

export default class SidebarToggleWidget extends ButtonWidget {
    refreshIcon() {
        const isLeftPaneVisible = options.is('leftPaneVisible');

        this.settings.icon = isLeftPaneVisible
            ? "bx-chevrons-left"
            : "bx-chevrons-right";

        this.settings.title = isLeftPaneVisible
            ? "Hide sidebar."
            : "Open sidebar.";

        this.settings.command = isLeftPaneVisible
            ? "hideSidebar"
            : "showSidebar";

        super.refreshIcon();

        splitService.setupSplit(isLeftPaneVisible);
    }

    hideSidebarCommand() {
        options.save(`leftPaneVisible`, "false");
    }

    showSidebarCommand() {
        options.save(`leftPaneVisible`, "true");
    }

    entitiesReloadedEvent({loadResults}) {
        if (loadResults.isOptionReloaded("leftPaneVisible")) {
            this.refreshIcon();
        }
    }
}
