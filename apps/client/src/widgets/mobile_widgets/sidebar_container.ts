import type { EventData } from "../../components/app_context.js";
import type { Screen } from "../../components/mobile_screen_switcher.js";
import options from "../../services/options.js";
import { isIOS, isNarrowLayout, onNarrowLayoutChange } from "../../services/utils.js";
import type BasicWidget from "../basic_widget.js";
import FlexContainer, { type FlexDirection } from "../containers/flex_container.js";

const DRAG_STATE_NONE = 0;
const DRAG_STATE_INITIAL_DRAG = 1;
const DRAG_STATE_DRAGGING = 2;

/** Percentage of drag that the user has to do in order for the popup to open (0-100). */
const DRAG_OPEN_THRESHOLD = 10;

/** The number of pixels the user has to drag across the screen to the right when the sidebar is closed to trigger the drag open animation. */
const DRAG_CLOSED_START_THRESHOLD = 10;
/** The number of pixels the user has to drag across the screen to the left when the sidebar is opened to trigger the drag close animation. */
const DRAG_OPENED_START_THRESHOLD = 100;
/** How far the navigator lies toward the start while the note covers it in a navigation stack (0-100). */
const STACK_PARALLAX = 30;

/**
 * Whether the tree and the note form a navigation stack, as on iOS phones: the tree lies under the
 * note, which slides away to reveal it, in place of a drawer sliding over the note.
 */
export function isNavigationStack() {
    return isIOS() && isNarrowLayout();
}

export default class SidebarContainer extends FlexContainer<BasicWidget> {
    private screenName: Screen;
    /** The screen name that is currently active, according to the screen changed event. */
    private activeScreenName?: Screen;
    private currentTranslate: number;
    private dragState: number;
    private startX?: number;
    private translatePercentage: number;
    private sidebarEl!: HTMLElement;
    private backdropEl!: HTMLElement;
    private detailEl?: HTMLElement;
    private originalSidebarTransition: string;
    private originalDetailTransition: string;
    private originalBackdropTransition: string;
    private screenWidth: number;
    /** Whether the sidebar is shown in tablet mode, where it sits next to the note (same option as the left pane on desktop). */
    private leftPaneVisible: boolean;

    constructor(screenName: Screen, direction: FlexDirection) {
        super(direction);

        this.screenName = screenName;
        this.leftPaneVisible = options.is("leftPaneVisible");
        this.currentTranslate = -100;
        this.translatePercentage = 0;
        this.dragState = DRAG_STATE_NONE;
        this.originalSidebarTransition = "";
        this.originalBackdropTransition = "";
        this.originalDetailTransition = "";
        this.screenWidth = document.body.getBoundingClientRect().width;
    }

    doRender() {
        super.doRender();

        // Only has an effect in tablet mode, see `style.css`.
        this.$widget.toggleClass("left-pane-hidden", !this.leftPaneVisible);

        this.#updateNavigationStack();
        onNarrowLayoutChange(() => this.#updateNavigationStack());

        document.addEventListener("touchstart", (e) => this.#onDragStart(e));
        document.addEventListener("touchmove", (e) => this.#onDragMove(e), { passive: false });
        document.addEventListener("touchend", (e) => this.#onDragEnd(e));
    }

    #onDragStart(e: TouchEvent | MouseEvent) {
        const x = "touches" in e ? e.touches[0].clientX : e.clientX;
        this.startX = x;

        // Prevent dragging if too far from the edge of the screen and the menu is closed.
        const dragRefX = glob.isRtl ? this.screenWidth - x : x;
        if (dragRefX > 30 && this.currentTranslate === -100) {
            return;
        }

        // In a navigation stack, the note comes back by opening it, not by a swipe.
        if (isNavigationStack() && this.currentTranslate !== -100) {
            return;
        }

        this.#setInitialState();
        this.dragState = DRAG_STATE_INITIAL_DRAG;
        this.translatePercentage = 0;
    }

    #onDragMove(e: TouchEvent | MouseEvent) {
        if (this.dragState === DRAG_STATE_NONE || !this.startX) {
            return;
        }

        const x = "touches" in e ? e.touches[0].clientX : e.clientX;
        const deltaX = glob.isRtl ? this.startX - x : x - this.startX;
        if (this.dragState === DRAG_STATE_INITIAL_DRAG) {
            if (this.currentTranslate === -100 ? deltaX > DRAG_CLOSED_START_THRESHOLD : deltaX < -DRAG_OPENED_START_THRESHOLD) {
                /* Disable the transitions since they affect performance, they are going to reenabled once drag ends. */
                this.sidebarEl.style.transition = "none";
                this.backdropEl.style.transition = "none";
                if (this.detailEl) this.detailEl.style.transition = "none";

                this.backdropEl.style.opacity = String(this.currentTranslate === -100 ? 0 : 1);
                this.backdropEl.classList.add("show");

                this.dragState = DRAG_STATE_DRAGGING;
            }

            if (this.currentTranslate !== -100) {
                // Return early to avoid consuming the event, this allows the user to scroll vertically.
                return;
            }
        } else if (this.dragState === DRAG_STATE_DRAGGING) {
            const width = this.sidebarEl.offsetWidth;
            const translatePercentage = Math.min(0, Math.max(this.currentTranslate + (deltaX / width) * 100, -100));
            const backdropOpacity = Math.max(0, 1 + translatePercentage / 100);
            this.translatePercentage = translatePercentage;
            this.#applyTranslate(translatePercentage);
            this.backdropEl.style.opacity = String(backdropOpacity);
        }

        // Consume the event to prevent the user from doing the back to previous page gesture on iOS.
        e.preventDefault();
    }

    #onDragEnd(e: TouchEvent | MouseEvent) {
        if (this.dragState === DRAG_STATE_NONE) {
            return;
        }

        if (this.dragState === DRAG_STATE_INITIAL_DRAG) {
            this.dragState = DRAG_STATE_NONE;
            return;
        }

        // If the sidebar is closed, snap the sidebar open only if the user swiped over a threshold.
        // When the sidebar is open, always close for a smooth experience.
        const isOpen = this.currentTranslate === -100 && this.translatePercentage > -(100 - DRAG_OPEN_THRESHOLD);
        const screen = isOpen ? "tree" : "detail";

        if (this.activeScreenName !== screen) {
            // Trigger the set active screen command for the rest of the UI to know whether the sidebar is active or not.
            // This allows the toggle sidebar button to work, by knowing the right state.
            this.triggerCommand("setActiveScreen", { screen });
        } else {
            // If the active screen hasn't changed, usually due to the user making a very short gesture that results in the sidebar not being closed/opened,
            // we need to hide the animation but setActiveScreen command will not trigger the event since we are still on the same screen.
            this.#setSidebarOpen(isOpen);
        }
    }

    #setInitialState() {
        if (this.sidebarEl) {
            // Already initialized.
            return;
        }

        const sidebarEl = document.getElementById("mobile-sidebar-wrapper");
        const backdropEl = document.getElementById("mobile-sidebar-container");
        backdropEl?.addEventListener("click", () => {
            this.triggerCommand("setActiveScreen", { screen: "detail" });
        });

        if (!sidebarEl || !backdropEl) {
            throw new Error("Unable to find the sidebar or backdrop.");
        }

        this.sidebarEl = sidebarEl;
        this.backdropEl = backdropEl;
        this.originalSidebarTransition = this.sidebarEl.style.transition;
        this.originalBackdropTransition = this.backdropEl.style.transition;

        this.detailEl = document.getElementById("detail-container") ?? undefined;
        this.originalDetailTransition = this.detailEl?.style.transition ?? "";
    }

    /** Marks the body while the tree and the note form a navigation stack, and repositions both. */
    #updateNavigationStack() {
        document.body.classList.toggle("navigation-stack", isNavigationStack());
        this.#setSidebarOpen(this.currentTranslate === 0);
    }

    /**
     * Places the tree `translatePercentage` of the way from open (0) to closed (-100): in a drawer by
     * moving the tree over the note, in a navigation stack by moving the note off the tree.
     */
    #applyTranslate(translatePercentage: number) {
        const direction = glob.isRtl ? -1 : 1;

        if (!isNavigationStack()) {
            this.sidebarEl.style.transform = `translateX(${direction * translatePercentage}%)`;
            if (this.detailEl) this.detailEl.style.transform = "";
            return;
        }

        const openness = 100 + translatePercentage;
        this.sidebarEl.style.transform = `translateX(${-direction * STACK_PARALLAX * (100 - openness) / 100}%)`;
        if (this.detailEl) this.detailEl.style.transform = `translateX(${direction * openness}%)`;
    }

    #setSidebarOpen(isOpen: boolean) {
        if (!this.sidebarEl) {
            return;
        }

        this.sidebarEl.classList.toggle("show", isOpen);
        this.#applyTranslate(isOpen ? 0 : -100);
        this.sidebarEl.style.transition = this.originalSidebarTransition;
        if (this.detailEl) this.detailEl.style.transition = this.originalDetailTransition;

        this.backdropEl.classList.toggle("show", isOpen);
        this.backdropEl.style.transition = this.originalBackdropTransition;
        this.backdropEl.style.opacity = String(isOpen ? 1 : 0);

        this.currentTranslate = isOpen ? 0 : -100;
        this.dragState = DRAG_STATE_NONE;
    }

    setLeftPaneVisibilityEvent({ leftPaneVisible }: EventData<"setLeftPaneVisibility">) {
        const visible = leftPaneVisible ?? !this.leftPaneVisible;
        if (visible === this.leftPaneVisible) return;

        this.leftPaneVisible = visible;
        this.$widget.toggleClass("left-pane-hidden", !this.leftPaneVisible);

        options.save("leftPaneVisible", this.leftPaneVisible.toString());
    }

    activeScreenChangedEvent({ activeScreen }: EventData<"activeScreenChanged">) {
        this.activeScreenName = activeScreen;
        this.#setInitialState();
        this.#setSidebarOpen(activeScreen === this.screenName);
    }
}
