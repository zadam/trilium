import "./mobile_editor_toolbar.css";

import type { CKTextEditor, ClassicEditor } from "@triliumnext/ckeditor5";
import clsx from "clsx";
import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";

import { isIOS } from "../../../services/utils";
import { HideKeyboardAction, usePositioningOniOS } from "../../mobile_widgets/hide_keyboard_button";
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
                <HideKeyboardAction className="hide-keyboard-action" />
            </div>
        </div>
    );
}

/**
 * Whether either editor has the focus, as its `focusTracker` reports it. The tracker of a classic
 * editor covers its toolbar and the panels of the toolbar's dropdowns too, wherever the toolbar is
 * placed.
 */
export function useEditorsFocused(
    noteEditor: CKTextEditor | null | undefined,
    nestedEditor: CKTextEditor | null | undefined
) {
    const [ focused, setFocused ] = useState(false);

    useEffect(() => {
        const trackers = [ noteEditor, nestedEditor ]
            .flatMap((editor) => editor ? [ editor.ui.focusTracker ] : []);
        const update = () => setFocused(trackers.some((tracker) => tracker.isFocused));
        update();
        for (const tracker of trackers) {
            tracker.on("change:isFocused", update);
        }
        return () => {
            for (const tracker of trackers) {
                tracker.off("change:isFocused", update);
            }
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
 * the layout of an open keyboard.
 */
export function useKeyboardPanel(enabled: boolean) {
    const [ isPanel ] = useState(() => enabled
        && !!document.getElementById("root-widget")?.classList.contains("virtual-keyboard-opened"));

    useLayoutEffect(() => {
        if (!isPanel) return;
        document.body.classList.add("keyboard-panel-open");
        return () => document.body.classList.remove("keyboard-panel-open");
    }, [ isPanel ]);

    return isPanel;
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
