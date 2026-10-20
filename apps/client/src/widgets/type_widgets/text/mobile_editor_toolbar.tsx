import "./mobile_editor_toolbar.css";

import type { CKTextEditor, ClassicEditor } from "@triliumnext/ckeditor5";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import { isIOS } from "../../../services/utils";
import {
    HideKeyboardAction, holdVisibleBottom, usePositioningOniOS
} from "../../mobile_widgets/hide_keyboard_button";
import { useIsNoteReadOnly, useNoteContext, useNoteProperty, useTriliumEvent } from "../../react/hooks";
import { useNestedEditor } from "./editable_embed";

/**
 * Handles the editing toolbar for CKEditor in mobile mode. The toolbar acts as a floating bar, with two different mechanism:
 *
 * - On iOS, because it does not respect the viewport meta value `interactive-widget=resizes-content`, we need to listen to window resizes and scroll and reposition the toolbar using absolute positioning.
 * - On Android, the viewport change makes the keyboard resize the content area, all we have to do is to hide the tab bar and global menu (handled in the global style).
 */
export default function MobileEditorToolbar() {
    const outerRef = useRef<HTMLDivElement>(null);
    const islandRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const { note, noteContext, ntxId } = useNoteContext();
    const noteType = useNoteProperty(note, "type");
    const { isReadOnly } = useIsNoteReadOnly(note, noteContext);
    const shouldDisplay = noteType === "text" && isReadOnly === false;
    const [ dropdownActive, setDropdownActive ] = useState(false);
    const [ noteEditor, setNoteEditor ] = useState<CKTextEditor>();
    const nestedEditor = useNestedEditor(ntxId);
    const editor = nestedEditor?.ui.view.toolbar ? nestedEditor : noteEditor;
    const toolbarElement = useShownToolbarElement(editor);
    const isActive = useEditorsFocused(noteEditor, nestedEditor) || dropdownActive;
    // A press outside the menu closes it as it starts, so the X's click only brings the keyboard
    // back, focusing the text within the tap.
    const isPanelOpen = useIsKeyboardPanelOpen();

    usePositioningOniOS(islandRef, outerRef);

    // Attach the toolbar from the CKEditor.
    useTriliumEvent("textEditorRefreshed", ({ ntxId: eventNtxId, editor }) => {
        if (eventNtxId !== ntxId) return;

        repositionDropdowns(editor);
        setNoteEditor(editor);
    });

    useEffect(() => {
        if (nestedEditor) {
            repositionDropdowns(nestedEditor);
        }
    }, [ nestedEditor ]);

    useEffect(() => {
        if (toolbarElement) {
            containerRef.current?.replaceChildren(toolbarElement);
        } else {
            containerRef.current?.replaceChildren();
        }
    }, [ toolbarElement ]);

    // Observe when a dropdown is expanded to apply a style that allows the dropdown to be visible, since we can't have the element both visible and the toolbar scrollable.
    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new MutationObserver(e => {
            setDropdownActive(e.map((e) => (e.target as any).ariaExpanded === "true").reduce((acc, e) => acc && e));
        });

        observer.observe(containerRef.current, {
            attributeFilter: ["aria-expanded"],
            subtree: true
        });

        return () => observer.disconnect();
    }, []);

    return (
        <div
            ref={outerRef}
            className={clsx(
                "classic-toolbar-outer-container",
                shouldDisplay ? "visible" : "hidden-ext",
                { active: shouldDisplay && isActive, ios: isIOS() }
            )}
        >
            <div ref={islandRef} className="classic-toolbar-island">
                <div ref={containerRef} className={`classic-toolbar-widget ${dropdownActive ? "dropdown-active" : ""}`} />
                <HideKeyboardAction
                    className="hide-keyboard-action"
                    closeMenu={isPanelOpen ? () => editor?.editing.view.focus() : undefined}
                />
            </div>
        </div>
    );
}

/**
 * Whether either editor has the focus, as its `focusTracker` reports it. The tracker of a classic
 * editor covers its toolbar and the panels of the toolbar's dropdowns too, wherever the toolbar is
 * placed. An editor focused as a closed panel keeps the keyboard's place counts as focused until
 * the place is given back: the press that closes the panel blurs the editor until its click lands.
 */
export function useEditorsFocused(
    noteEditor: CKTextEditor | null | undefined,
    nestedEditor: CKTextEditor | null | undefined
) {
    const [ focused, setFocused ] = useState(false);

    useEffect(() => {
        const trackers = [ noteEditor, nestedEditor ]
            .flatMap((editor) => editor ? [ editor.ui.focusTracker ] : []);
        const update = () => setFocused((wasFocused) =>
            trackers.some((tracker) => tracker.isFocused) || (wasFocused && isKeyboardPanelOpen()));
        update();
        for (const tracker of trackers) {
            tracker.on("change:isFocused", update);
        }
        keyboardPanelListeners.add(update);
        return () => {
            for (const tracker of trackers) {
                tracker.off("change:isFocused", update);
            }
            keyboardPanelListeners.delete(update);
        };
    }, [ noteEditor, nestedEditor ]);

    return focused;
}

/**
 * The element of the toolbar `editor` shows: the `TextFormattingToolbar` while it is active, and
 * the editor's own toolbar otherwise.
 */
export function useShownToolbarElement(editor: CKTextEditor | undefined) {
    const formatting = editor?.plugins.has("TextFormattingToolbar")
        ? editor.plugins.get("TextFormattingToolbar")
        : undefined;
    const [ formattingActive, setFormattingActive ] = useState(false);

    useEffect(() => {
        if (!formatting) {
            setFormattingActive(false);
            return;
        }
        const update = () => setFormattingActive(formatting.isActive);
        update();
        formatting.on("change:isActive", update);
        return () => formatting.off("change:isActive", update);
    }, [ formatting ]);

    const element = formatting && formattingActive
        ? formatting.toolbarView.element
        : editor?.ui.view.toolbar?.element;
    return element ?? undefined;
}

/**
 * Whether a menu of the formatting toolbar opens in the place of the keyboard, as it does when the
 * keyboard is up as it opens: the keyboard closes as the menu takes focus, and the menu fills its
 * `--tn-keyboard-height`. While such a menu is mounted, `keyboard-panel-open` on the body keeps
 * the layout of an open keyboard. `replacesPanel` is set for a menu that opens as another one
 * leaves the place, which it takes over without a reveal.
 */
export function useKeyboardPanel(enabled: boolean) {
    const [ { isPanel, replacesPanel } ] = useState(() => {
        const root = document.getElementById("root-widget");
        const isKeyboardUp = !!root?.classList.contains("virtual-keyboard-opened");
        const isPanel = enabled && (isKeyboardUp || isKeyboardPanelOpen());
        return { isPanel, replacesPanel: isPanel && !!pendingHandBack };
    });

    useLayoutEffect(() => {
        if (!isPanel) return;
        takeKeyboardPlace();
        return handBackKeyboardPlace;
    }, [ isPanel ]);

    return { isPanel, replacesPanel };
}

/** The row of buttons of the phone's toolbar, which scrolls sideways under a menu of it. */
export const MOBILE_TOOLBAR_ROW = ".classic-toolbar-island .classic-toolbar-widget";

/**
 * Closes a menu of the toolbar as a tap on another item of {@link MOBILE_TOOLBAR_ROW} clicks, before
 * the item runs. The menu's `Popup` keeps it open on a press there, which can start a scroll; the
 * menu's own button, at `anchor`, toggles it in the editor.
 */
export function useClosedByToolbarTap(anchor: HTMLElement, close: () => void) {
    const closeRef = useRef(close);
    closeRef.current = close;

    useLayoutEffect(() => {
        const onClick = (event: MouseEvent) => {
            const target = event.target;
            if (!(target instanceof Element) || anchor.contains(target)) return;
            if (target.closest(MOBILE_TOOLBAR_ROW)) closeRef.current();
        };
        window.addEventListener("click", onClick, true);
        return () => window.removeEventListener("click", onClick, true);
    }, [ anchor ]);
}

/** Whether a menu of the toolbar is in the keyboard's place, for its host to tell the editor. */
export function isKeyboardPanelOpen() {
    return document.body.classList.contains("keyboard-panel-open");
}

/** {@link isKeyboardPanelOpen}, followed as the place is taken and given back. */
export function useIsKeyboardPanelOpen() {
    const [ isOpen, setIsOpen ] = useState(isKeyboardPanelOpen);

    useEffect(() => {
        const update = () => setIsOpen(isKeyboardPanelOpen());
        update();
        keyboardPanelListeners.add(update);
        return () => {
            keyboardPanelListeners.delete(update);
        };
    }, []);

    return isOpen;
}

/** How long a closed panel keeps the keyboard's place for a keyboard that does not come back. */
const KEYBOARD_RETURN_TIMEOUT = 1000;
/** How long a closed panel waits for the click of the press that closed it, which can scroll. */
const PRESS_TIMEOUT = 500;

/** The hand-back of a closed panel's place, while it waits for the keyboard. */
let pendingHandBack: { cancel(): void } | undefined;
/** Called as `keyboard-panel-open` is set on the body or cleared. */
const keyboardPanelListeners = new Set<() => void>();

/**
 * Lays the page out as for an open keyboard, or keeps the layout a closed panel still holds for
 * the keyboard, with the visible bottom it was taken at.
 */
function takeKeyboardPlace() {
    if (pendingHandBack) {
        pendingHandBack.cancel();
        pendingHandBack = undefined;
        return;
    }
    setKeyboardPanelOpen(true);
    holdVisibleBottom(true);
}

/**
 * Gives a closed panel's place back. When the text has the focus once the menu has closed, as
 * after an entry runs or the menu's own button closes it, the keyboard is on its way, so the
 * layout stays until `RootContainer` reports it up; laying out for no keyboard in between drops
 * the toolbar and brings the launcher bar back for some 250ms. A menu that a press closes, which
 * `Popup` does as the press starts, keeps the layout until the press's click: that click can open
 * the menu of another button of the toolbar, or focus the text, and the button must not move from
 * under it.
 */
function handBackKeyboardPlace() {
    let isCancelled = false;
    let stopWaiting = () => {};
    const handBack = {
        cancel() {
            isCancelled = true;
            stopWaiting();
        }
    };
    pendingHandBack = handBack;
    const release = () => {
        stopWaiting();
        if (pendingHandBack === handBack) pendingHandBack = undefined;
        setKeyboardPanelOpen(false);
        holdVisibleBottom(false);
    };

    const waitForKeyboard = () => {
        const root = document.getElementById("root-widget");
        if (!root || root.classList.contains("virtual-keyboard-opened")) {
            release();
            return;
        }
        const observer = new MutationObserver(() => {
            if (root.classList.contains("virtual-keyboard-opened")) release();
        });
        observer.observe(root, { attributeFilter: [ "class" ] });
        const timer = setTimeout(release, KEYBOARD_RETURN_TIMEOUT);
        stopWaiting = () => {
            observer.disconnect();
            clearTimeout(timer);
        };
    };
    const settle = () => {
        if (isCancelled) return;
        if (isTextFocused()) {
            waitForKeyboard();
        } else {
            release();
        }
    };

    // The plugin focuses the text after the menu has unmounted, in the same task.
    queueMicrotask(() => {
        if (isCancelled) return;
        if (isTextFocused()) {
            waitForKeyboard();
            return;
        }
        // What the click runs, such as opening another menu, runs before `settle`.
        const onClick = () => {
            stopWaiting();
            setTimeout(settle);
        };
        window.addEventListener("click", onClick, true);
        const timer = setTimeout(() => {
            stopWaiting();
            settle();
        }, PRESS_TIMEOUT);
        stopWaiting = () => {
            window.removeEventListener("click", onClick, true);
            clearTimeout(timer);
        };
    });
}

function isTextFocused() {
    return !!document.activeElement?.closest(".ck-editor__editable");
}

function setKeyboardPanelOpen(isOpen: boolean) {
    document.body.classList.toggle("keyboard-panel-open", isOpen);
    for (const listener of keyboardPanelListeners) {
        listener();
    }
}

/** The editors whose toolbar dropdowns open upwards already. */
const repositionedEditors = new WeakSet<CKTextEditor>();

/**
 * Reposition all dropdowns to point upwards instead of downwards.
 * See https://ckeditor.com/docs/ckeditor5/latest/examples/framework/bottom-toolbar-editor.html for more info.
 * @param editor
 */
function repositionDropdowns(editor: CKTextEditor) {
    if (repositionedEditors.has(editor)) return;
    repositionedEditors.add(editor);

    const toolbarViews = [ (editor as ClassicEditor).ui.view.toolbar ];
    if (editor.plugins.has("TextFormattingToolbar")) {
        toolbarViews.push(editor.plugins.get("TextFormattingToolbar").toolbarView);
    }
    for (const item of toolbarViews.flatMap((toolbarView) => [ ...toolbarView.items ])) {
        if (!("panelView" in item)) continue;

        item.on("change:isOpen", () => {
            if (!("isOpen" in item) || !item.isOpen) return;

            // @ts-ignore
            item.panelView.position = item.panelView.position.replace("s", "n");
        });
    }
}
