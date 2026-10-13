import { resolveBlockReference } from "@triliumnext/commons/src/lib/block_reference.js";

import "../../theme/block_reference.css";
import { CLASSES as TAB_CLASSES } from "../tabs/constants.js";
import { revealTab } from "../tabs/tabs_read_only.js";

const FLASH_CLASS = "block-reference-flash";
/** The duration of the `block-reference-flash` animation in `block_reference.css`. */
const FLASH_DURATION_MS = 1500;

/**
 * Scrolls to the blocks that `value`, a `block` link parameter, points at in `container` and
 * flashes them. Of a broken range, the block found is shown. Returns `false` when a block is
 * missing.
 *
 * The module imports nothing from CKEditor, so pages that only display content can load it.
 */
export function showBlockReference(container: Element, value: string) {
    const { start, end } = resolveBlockReference<HTMLElement>(container, value);
    const first = start ?? end;
    if (first) {
        reveal(first);
        getBlockBoxes(first).top.scrollIntoView({ behavior: "smooth", block: "center" });
        flashBlocks(start && end ? getBlockRangeElements(start, end) : [ first ]);
    }

    return !!start && !!end;
}

/** Flashes `elements` for a moment. */
export function flashBlocks(elements: Element[]) {
    for (const element of elements) {
        element.classList.add(FLASH_CLASS);
        setTimeout(() => element.classList.remove(FLASH_CLASS), FLASH_DURATION_MS);
    }
}

/**
 * Returns the elements that render the top and bottom of `block`. A tab is `display: contents`, so
 * its title and panel render it.
 */
export function getBlockBoxes(block: Element): { top: Element; bottom: Element } {
    if (block.classList.contains(TAB_CLASSES.tab)) {
        const title = block.querySelector(`:scope > .${TAB_CLASSES.tabTitle}`);
        const panel = block.querySelector(`:scope > .${TAB_CLASSES.tabPanel}`);
        if (title && panel) {
            return { top: title, bottom: panel };
        }
    }
    return { top: block, bottom: block };
}

/** The outermost elements inside the range from `start` to `end`, both included. */
export function getBlockRangeElements(start: Element, end: Element) {
    const range = start.ownerDocument.createRange();
    range.setStartBefore(start);
    range.setEndAfter(end);
    return getElementsInRange(range, range.commonAncestorContainer);
}

/** Opens the `<details>` and shows the tabs that enclose `element`. */
function reveal(element: Element) {
    let details = element.closest("details");
    while (details) {
        details.open = true;
        details = details.parentElement?.closest("details") ?? null;
    }
    revealTab(element);
}

function getElementsInRange(range: Range, parent: Node): Element[] {
    const elements: Element[] = [];
    for (const child of Array.from(parent.childNodes)) {
        if (!(child instanceof Element) || !range.intersectsNode(child)) {
            continue;
        }

        if (isInRange(range, child)) {
            elements.push(child);
        } else {
            elements.push(...getElementsInRange(range, child));
        }
    }

    return elements;
}

function isInRange(range: Range, node: Node) {
    const nodeRange = range.cloneRange();
    nodeRange.selectNode(node);
    return range.compareBoundaryPoints(Range.START_TO_START, nodeRange) <= 0
        && range.compareBoundaryPoints(Range.END_TO_END, nodeRange) >= 0;
}
