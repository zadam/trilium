import ButtonWidget from "./button_widget.js";
import protectedSessionHolder from "../../services/protected_session_holder.js";

export default class ProtectedSessionStatusWidget extends ButtonWidget {
    doRender() {
        this.updateSettings();

        super.doRender();
    }

    updateSettings() {
        this.settings.icon = protectedSessionHolder.isProtectedSessionAvailable()
            ? "bx-shield-quarter"
            : "bx-log-in";

        this.settings.title = protectedSessionHolder.isProtectedSessionAvailable()
            ? "Protected session is active. Click to leave protected session."
            : "Click to enter protected session";

        this.settings.command = protectedSessionHolder.isProtectedSessionAvailable()
            ? "leaveProtectedSession"
            : "enterProtectedSession";
    }

    protectedSessionStartedEvent() {
        this.updateSettings();
        this.refreshIcon();
    }
}
