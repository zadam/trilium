import "./left_pane_container.css";

import appContext, { type EventData } from "../../components/app_context.js";
import type Component from "../../components/component.js";
import options from "../../services/options.js";
import resizer from "../../services/resizer.js";
import {
    type PaneAction, type PaneMode, persistedPaneVisible, reducePaneMode, watchPeekDismiss
} from "../react/peek_pane.js";
import Container from "./container.js";

/**
 * The host of `#left-pane`, which holds the note tree. Owns the pane's mode: closed, docked, or
 * peeked over the content.
 */
export default class LeftPaneContainer extends Container<Component> {

    private readonly isPeekable: boolean;
    private mode: PaneMode;
    private stopPeekDismiss?: () => void;

    /** @param isPeekable whether the pane can peek, which only the horizontal layout supports. */
    constructor(isPeekable: boolean) {
        super();

        this.isPeekable = isPeekable;
        this.mode = options.is("leftPaneVisible") ? "docked" : "closed";

        this.id("left-pane-host");
        this.class("peek-pane-host side-start");
        this.collapsible();
    }

    doRender() {
        super.doRender();
        const $pane = $(`<div id="left-pane" class="peek-pane">`).append(this.$widget.children());
        this.$widget.append($pane, $(`<div class="peek-pane-spacer">`));
    }

    isEnabled() {
        return super.isEnabled() && this.mode !== "closed";
    }

    initialRenderCompleteEvent() {
        this.applyMode();
    }

    setLeftPaneVisibilityEvent({ leftPaneVisible }: EventData<"setLeftPaneVisibility">) {
        if (leftPaneVisible === null) {
            this.changeMode("toggleDocked");
        } else {
            this.changeMode(leftPaneVisible ? "dock" : "close");
        }
    }

    peekLeftPaneEvent() {
        if (this.isPeekable) {
            this.changeMode("togglePeek");
        }
    }

    paneModeChangedEvent({ pane, mode }: EventData<"paneModeChanged">) {
        if (pane !== "left" && mode === "peek") {
            this.changeMode("dismiss");
        }
    }

    private changeMode(action: PaneAction) {
        const prev = this.mode;
        this.mode = reducePaneMode(prev, action);
        if (this.mode === prev) return;

        this.applyMode();

        const persist = persistedPaneVisible(prev, this.mode);
        if (persist !== null) {
            options.save("leftPaneVisible", persist.toString());
        }

        if (this.mode !== "closed") {
            this.triggerEvent("focusTree", {});
        } else if (action === "close" || action === "toggleDocked") {
            // Only a hard close moves the focus. A dismissed peek leaves it on the pressed element.
            const ntxId = appContext.tabManager.getActiveContext()?.ntxId;
            const noteContainer = document.querySelector(`.note-split[data-ntx-id="${ntxId}"]`);
            if (!noteContainer?.contains(document.activeElement)) {
                this.triggerEvent("focusOnDetail", { ntxId });
            }
        }

        this.triggerEvent("paneModeChanged", { pane: "left", mode: this.mode });
    }

    private applyMode() {
        this.toggleInt(this.isEnabled());
        this.$widget.toggleClass("peek", this.mode === "peek");
        this.parent?.$widget.toggleClass("left-pane-hidden", this.mode !== "docked");
        resizer.setupLeftPaneResizer(this.mode);

        this.stopPeekDismiss?.();
        this.stopPeekDismiss = this.mode === "peek"
            ? watchPeekDismiss(() => this.changeMode("dismiss"), {
                keepOpenSelector: "#left-pane, .left-pane-peek-button, .left-pane-toggle-button",
                focusSelector: ".left-pane-peek-button"
            })
            : undefined;
    }
}
