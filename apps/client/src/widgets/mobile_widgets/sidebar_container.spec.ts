import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from "vitest";

import options from "../../services/options";
import SidebarContainer from "./sidebar_container";

describe("SidebarContainer", () => {
    let save: MockInstance<typeof options.save>;

    beforeEach(() => {
        save = vi.spyOn(options, "save").mockResolvedValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    function render(leftPaneVisible: boolean) {
        options.set("leftPaneVisible", leftPaneVisible.toString());
        const sidebar = new SidebarContainer("tree", "column");
        sidebar.render();
        return sidebar;
    }

    it("hides in tablet mode like the left pane, sharing its option", () => {
        expect(render(false).$widget.hasClass("left-pane-hidden")).toBe(true);

        const sidebar = render(true);
        expect(sidebar.$widget.hasClass("left-pane-hidden")).toBe(false);

        // The sidebar toggle in the title row.
        sidebar.setLeftPaneVisibilityEvent({ leftPaneVisible: null });
        expect(sidebar.$widget.hasClass("left-pane-hidden")).toBe(true);
        expect(save).toHaveBeenLastCalledWith("leftPaneVisible", "false");

        sidebar.setLeftPaneVisibilityEvent({ leftPaneVisible: null });
        expect(sidebar.$widget.hasClass("left-pane-hidden")).toBe(false);
        expect(save).toHaveBeenLastCalledWith("leftPaneVisible", "true");

        // The "hide/show panel" commands.
        sidebar.setLeftPaneVisibilityEvent({ leftPaneVisible: false });
        expect(sidebar.$widget.hasClass("left-pane-hidden")).toBe(true);
        sidebar.setLeftPaneVisibilityEvent({ leftPaneVisible: true });
        expect(sidebar.$widget.hasClass("left-pane-hidden")).toBe(false);

        // Showing an already visible sidebar leaves the option alone.
        save.mockClear();
        sidebar.setLeftPaneVisibilityEvent({ leftPaneVisible: true });
        expect(sidebar.$widget.hasClass("left-pane-hidden")).toBe(false);
        expect(save).not.toHaveBeenCalled();
    });
});
