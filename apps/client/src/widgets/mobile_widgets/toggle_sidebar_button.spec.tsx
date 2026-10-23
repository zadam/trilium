import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderInto } from "../../test/render";

const { triggerCommand } = vi.hoisted(() => ({ triggerCommand: vi.fn() }));

vi.mock("../react/hooks", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../react/hooks")>()),
    useNoteContext: () => ({
        noteContext: { isMainContext: () => true },
        parentComponent: { triggerCommand }
    }),
    useStaticTooltip: vi.fn()
}));

import ToggleSidebarButton from "./toggle_sidebar_button";

/** Renders the button at a phone or tablet width and clicks it. */
function clickAt(width: "phone" | "tablet") {
    const matchMedia = vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
        matches: width === "tablet" && query === "(min-width: 992px)",
        media: query
    }) as MediaQueryList);

    const container = renderInto(<ToggleSidebarButton />);
    // `SplitNoteContainer` binds this on the `.note-split` the button renders inside.
    const activateSplit = vi.fn();
    container.addEventListener("click", activateSplit);

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    button?.click();

    expect(matchMedia).toHaveBeenCalledWith("(min-width: 992px)");
    expect(activateSplit).not.toHaveBeenCalled();
}

describe("ToggleSidebarButton", () => {
    beforeEach(() => {
        triggerCommand.mockClear();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("opens the sidebar on a phone without activating the split it sits in", () => {
        clickAt("phone");

        expect(triggerCommand).toHaveBeenCalledWith("setActiveScreen", { screen: "tree" });
        expect(triggerCommand).not.toHaveBeenCalledWith("toggleLeftPane");
    });

    it("toggles the sidebar on a tablet, where it sits next to the note", () => {
        clickAt("tablet");

        expect(triggerCommand).toHaveBeenCalledWith("toggleLeftPane");
        expect(triggerCommand).not.toHaveBeenCalledWith("setActiveScreen", expect.anything());
    });
});
