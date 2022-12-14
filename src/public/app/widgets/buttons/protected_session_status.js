import protectedSessionHolder from "../../services/protected_session_holder.js";
import CommandButtonWidget from "./command_button.js";

export default class ProtectedSessionStatusWidget extends CommandButtonWidget {
    constructor() {
        super();

        this.class("launcher-button");

        this.settings.icon = () => protectedSessionHolder.isProtectedSessionAvailable()
            ? "bx-check-shield"
            : "bx-shield-quarter";

        this.settings.title = () => protectedSessionHolder.isProtectedSessionAvailable()
            ? "Protected session is active. Click to leave protected session."
            : "Click to enter protected session";

        this.settings.command = () => protectedSessionHolder.isProtectedSessionAvailable()
            ? "leaveProtectedSession"
            : "enterProtectedSession";
    }

    protectedSessionStartedEvent() {
        this.refreshIcon();
    }
}
