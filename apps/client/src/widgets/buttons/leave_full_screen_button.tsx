import "./leave_full_screen_button.css";

import { t } from "../../services/i18n";
import ActionButton from "../react/ActionButton";

/** Leaves full screen. Shown in the tab bar only while `body.full-screen` is set. */
export default function LeaveFullScreenButton() {
    return (
        <ActionButton
            className="toggle-button leave-full-screen-button"
            text={t("tab_row.leave_full_screen")}
            icon="bx bx-exit-fullscreen"
            triggerCommand="toggleFullscreen"
        />
    );
}
