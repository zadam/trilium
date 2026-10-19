import "./hide_keyboard_button.css";

import { useEffect, useState } from "preact/hooks";

import { t } from "../../services/i18n";
import { isIOS, isMobileApp } from "../../services/utils";
import ActionButton from "../react/ActionButton";

/**
 * Closes the keyboard in the iOS app, which hides the keyboard's input accessory bar and with it the
 * "Done" button (see `ViewController.hideKeyboardInputAccessoryView()`). The button stands at the
 * bottom-end corner, just above the keyboard, while an editable element has the focus, whatever the
 * note type. Android needs none: the system Back closes the keyboard.
 */
export default function HideKeyboardButton() {
    const enabled = isMobileApp() && isIOS();
    const [ editableFocused, setEditableFocused ] = useState(false);

    useEffect(() => {
        if (!enabled) return;

        const onFocusIn = (e: FocusEvent) => setEditableFocused(isEditable(e.target));
        const onFocusOut = (e: FocusEvent) => setEditableFocused(isEditable(e.relatedTarget));
        setEditableFocused(isEditable(document.activeElement));
        document.addEventListener("focusin", onFocusIn);
        document.addEventListener("focusout", onFocusOut);
        return () => {
            document.removeEventListener("focusin", onFocusIn);
            document.removeEventListener("focusout", onFocusOut);
        };
    }, [ enabled ]);

    return (
        // Keeps the press from moving the focus onto the button: an open dialog's focus trap would
        // send it back into the dialog and bring the keyboard up again.
        <div className="hide-keyboard-button" onMouseDown={(e) => e.preventDefault()}>
            {enabled && editableFocused && (
                <ActionButton
                    icon="bx bx-chevron-down"
                    text={t("hide_keyboard_button.title")}
                    noTooltipOnTouch
                    onClick={() => {
                        if (document.activeElement instanceof HTMLElement) {
                            document.activeElement.blur();
                        }
                    }}
                />
            )}
        </div>
    );
}

/** Input types that take no typed text, so focusing them opens no keyboard. */
const NON_TEXT_INPUT_TYPES = new Set([
    "button", "checkbox", "color", "file", "hidden", "image", "radio", "range", "reset", "submit"
]);

export function isEditable(element: EventTarget | null) {
    if (element instanceof HTMLInputElement) {
        return !element.readOnly && !element.disabled && !NON_TEXT_INPUT_TYPES.has(element.type);
    }
    if (element instanceof HTMLTextAreaElement) {
        return !element.readOnly && !element.disabled;
    }
    return element instanceof HTMLElement && element.isContentEditable;
}
