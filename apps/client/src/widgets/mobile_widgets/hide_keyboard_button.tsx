import "./hide_keyboard_button.css";

import { RefObject } from "preact";
import { useCallback, useEffect, useRef } from "preact/hooks";

import { t } from "../../services/i18n";
import { isIOS } from "../../services/utils";
import ActionButton from "../react/ActionButton";

/**
 * Closes the virtual keyboard by blurring the focused element. The button stands at the bottom-end
 * corner, just above the keyboard, while `RootContainer` marks the keyboard as open with
 * `virtual-keyboard-opened`. While `MobileEditorToolbar` is shown, which it is while its editor has
 * the focus, the toolbar carries the button instead (see `hide_keyboard_button.css`).
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
                icon="bx bxs-keyboard"
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
 * Lifts an element at the bottom of its `anchorRef`, or of the screen for a fixed element, above
 * the keyboard in plain mobile Safari, which does not resize the page for the keyboard.
 */
export function usePositioningOniOS(
    wrapperRef: RefObject<HTMLDivElement | null>,
    anchorRef?: RefObject<HTMLElement | null>
) {
    // Safari shrinks `visualViewport` for the keyboard but not the layout, so the element rises by
    // how far its anchor reaches below the visible bottom. With the keyboard up Safari scrolls the
    // fixed page itself, and client coordinates move with that scroll, so the visible bottom is
    // `pageTop - scrollY + height`: `offsetTop + height` elsewhere, `height` in Safari. Under
    // Capacitor `resize: native` the layout shrinks too, so `obscured` is 0 and CSS stays in
    // charge.
    const adjustPosition = useCallback(() => {
        if (!wrapperRef.current) return;
        const viewport = window.visualViewport;
        if (!viewport) return;

        const anchorBottom = anchorRef?.current?.getBoundingClientRect().bottom
            ?? window.innerHeight;
        const visibleBottom = viewport.pageTop - window.scrollY + viewport.height;
        const obscured = Math.max(0, Math.round(anchorBottom - visibleBottom));

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
        const viewport = window.visualViewport;
        viewport?.addEventListener("resize", adjustPosition);
        viewport?.addEventListener("scroll", adjustPosition);
        return () => {
            viewport?.removeEventListener("resize", adjustPosition);
            viewport?.removeEventListener("scroll", adjustPosition);
        };
    }, [ adjustPosition ]);
}
