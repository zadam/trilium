import "./live_print.css";

import type FNote from "../entities/fnote";

/**
 * Prints an element of the app window as it is on screen instead of rendering its note again on the
 * `?print` page, so a render note keeps its script's state. `live_print.css` hides the rest of the
 * window under `@media print` only.
 */

const ACTIVE_CLASS = "print-live";
const TARGET_CLASS = "print-live-target";
/** Holds the `media` a theme stylesheet had before {@link startLivePrint} limited it to the screen. */
const ORIGINAL_MEDIA_ATTR = "data-live-print-media";
const PRINT_CSS_ATTR = "data-live-print-css";
/** Marks a scroll container that prints at its full height, without a scrollbar. */
const UNSCROLL_CLASS = "print-live-unscroll";

let activeTarget: HTMLElement | undefined;

/** Prepares the window to print `target`, ending any live print still active. */
export async function startLivePrint(note: FNote, target: HTMLElement) {
    endLivePrint();
    activeTarget = target;
    document.body.classList.add(ACTIVE_CLASS);
    target.classList.add(TARGET_CLASS);

    for (const el of target.querySelectorAll<HTMLElement>("*")) {
        const { overflowX, overflowY } = getComputedStyle(el);
        if ([ overflowX, overflowY ].some((overflow) => overflow === "auto" || overflow === "scroll")) {
            el.classList.add(UNSCROLL_CLASS);
        }
    }

    // Paper gets the light baseline (`theme-light.css`), as on the `?print` page, which loads no theme.
    for (const link of document.querySelectorAll<HTMLLinkElement>("link[data-theme-stylesheet]")) {
        link.setAttribute(ORIGINAL_MEDIA_ATTR, link.media);
        link.media = link.media ? `screen and ${link.media}` : "screen";
    }

    await loadPrintCss(note);
    await document.fonts.ready;
}

/** Restores the window after a live print. Does nothing when none is active. */
export function endLivePrint() {
    if (!activeTarget) return;

    activeTarget.classList.remove(TARGET_CLASS);
    for (const el of activeTarget.querySelectorAll(`.${UNSCROLL_CLASS}`)) {
        el.classList.remove(UNSCROLL_CLASS);
    }
    activeTarget = undefined;
    document.body.classList.remove(ACTIVE_CLASS);

    for (const link of document.querySelectorAll<HTMLLinkElement>(`link[${ORIGINAL_MEDIA_ATTR}]`)) {
        link.media = link.getAttribute(ORIGINAL_MEDIA_ATTR) ?? "";
        link.removeAttribute(ORIGINAL_MEDIA_ATTR);
    }

    for (const link of document.querySelectorAll(`link[${PRINT_CSS_ATTR}]`)) {
        link.remove();
    }
}

/** Prints `target` through the browser's own print dialog. */
export async function printLiveInBrowser(note: FNote, target: HTMLElement) {
    await startLivePrint(note, target);
    window.addEventListener("afterprint", endLivePrint, { once: true });
    window.print();
}

/** Applies the note's `~printCss` stylesheets to printing only. */
async function loadPrintCss(note: FNote) {
    const printCssNotes = await note.getRelationTargets("printCss");
    const loads: Promise<void>[] = [];

    for (const printCssNote of printCssNotes) {
        if (!printCssNote || (printCssNote.type !== "code" && printCssNote.mime !== "text/css")) continue;

        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.media = "print";
        link.href = `api/notes/${printCssNote.noteId}/download`;
        link.setAttribute(PRINT_CSS_ATTR, "true");
        loads.push(new Promise((resolve) => {
            link.onload = () => resolve();
            link.onerror = () => {
                console.warn(`Unable to load the print stylesheet ${printCssNote.noteId}; printing without it.`);
                resolve();
            };
        }));
        document.head.appendChild(link);
    }

    await Promise.all(loads);
}
