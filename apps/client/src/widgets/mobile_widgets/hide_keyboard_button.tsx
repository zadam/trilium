import "./hide_keyboard_button.css";

import { RefObject } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

import { t } from "../../services/i18n";
import { isIOS } from "../../services/utils";
import ActionButton from "../react/ActionButton";

/**
 * Closes the virtual keyboard by blurring the focused element. The button stands at the bottom-end
 * corner, just above the keyboard, while `RootContainer` marks the keyboard as open with
 * `virtual-keyboard-opened`. While the focus is in a note split or dialog that shows
 * `MobileEditorToolbar`, the toolbar carries the button instead (see `hide_keyboard_button.css`).
 * In the iOS app, blurring also hides the keyboard's input accessory bar (see
 * `ViewController.hideKeyboardInputAccessoryView()`).
 */
export default function HideKeyboardButton() {
    const containerRef = useRef<HTMLDivElement>(null);
    usePositioningOniOS(containerRef);

    return <HideKeyboardAction className="hide-keyboard-button" containerRef={containerRef} />;
}

/** The button alone, which `MobileEditorToolbar` places at the end of its island. */
export function HideKeyboardAction({ className, containerRef }: {
    className: string;
    containerRef?: RefObject<HTMLDivElement | null>;
}) {
    return (
        // Keeps the press from moving the focus onto the button: an open dialog's focus trap would
        // send it back into the dialog and bring the keyboard up again.
        <div ref={containerRef} className={className} onMouseDown={(e) => e.preventDefault()}>
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
        </div>
    );
}

/**
 * Lifts an element anchored to the bottom of the screen above the keyboard in plain mobile Safari,
 * which does not resize the page for the keyboard.
 */
export function usePositioningOniOS(wrapperRef: RefObject<HTMLDivElement | null>) {
    // Fallback path for plain mobile Safari (no Capacitor): the WKWebView
    // isn't resized when the keyboard opens, so visualViewport.height
    // shrinks while window.innerHeight stays the same. Push the element
    // up by the difference. Under Capacitor `resize: native` both values
    // shrink together, so `obscured` is 0 and we leave CSS in charge.
    const adjustPosition = useCallback(() => {
        if (!wrapperRef.current) return;
        const viewport = window.visualViewport;
        if (!viewport) return;

        const obscured = Math.max(0, Math.round(
            window.innerHeight - viewport.height - viewport.offsetTop
        ));

        if (obscured <= 1) {
            wrapperRef.current.style.removeProperty("bottom");
        } else {
            wrapperRef.current.style.bottom = `${obscured}px`;
        }
    }, [ wrapperRef ]);

    useEffect(() => {
        if (!isIOS()) return;
        // Run once in case the keyboard is already up when mounting
        // (e.g. returning from a dialog).
        adjustPosition();
        window.visualViewport?.addEventListener("resize", adjustPosition);
        return () => {
            window.visualViewport?.removeEventListener("resize", adjustPosition);
        };
    }, [ adjustPosition ]);
}
