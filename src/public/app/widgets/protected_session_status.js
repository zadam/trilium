import ButtonWidget from "./button_widget.js";
import protectedSessionHolder from "../services/protected_session_holder.js";

export default class ProtectedSessionStatusWidget extends ButtonWidget {
    constructor() {
        super();
    }

    doRender() {
        this.updateOptions();

        super.doRender();
    }

    updateOptions() {
        this.options.icon = protectedSessionHolder.isProtectedSessionAvailable()
            ? "bx-shield-quarter"
            : "bx-log-in";

        this.options.title = protectedSessionHolder.isProtectedSessionAvailable()
            ? "Protected session is active. Click to leave protected session."
            : "Click to enter protected session";

        this.options.command = protectedSessionHolder.isProtectedSessionAvailable()
            ? "leaveProtectedSession"
            : "enterProtectedSession";
    }

    protectedSessionStartedEvent() {
        this.updateOptions();
        this.refreshIcon();
    }
}
