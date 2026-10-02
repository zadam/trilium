import "./FormPasswordBox.css";

import { clsx } from "clsx";
import { useState } from "preact/hooks";

import { t } from "../../services/i18n";
import ActionButton from "./ActionButton";
import FormTextBox, { type FormTextBoxProps } from "./FormTextBox";

/**
 * A password box with an eye that shows the password in clear. The eye appears while the box has
 * the focus and stays while the password shows; pressing it keeps the focus in the box, so the
 * typing goes on.
 */
export default function FormPasswordBox({ type: _type, ...props }: FormTextBoxProps) {
    const [ revealed, setRevealed ] = useState(false);

    return (
        <span className={clsx("tn-password-box", { revealed })}>
            <FormTextBox {...props} type={revealed ? "text" : "password"} />
            {/* The focus change is mousedown's default action, so cancelling it here leaves the
                caret in the box while the click still toggles. */}
            <span onMouseDown={(e) => e.preventDefault()}>
                <ActionButton
                    className="tn-password-box-toggle"
                    icon={revealed ? "bx bx-hide" : "bx bx-show"}
                    text={revealed ? t("password_box.hide") : t("password_box.show")}
                    tooltipClass="tooltip-top"
                    onClick={() => setRevealed((shown) => !shown)}
                />
            </span>
        </span>
    );
}
