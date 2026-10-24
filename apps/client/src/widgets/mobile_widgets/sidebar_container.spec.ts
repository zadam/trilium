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

    describe("on a phone", () => {
        let tree: HTMLElement;
        let detail: HTMLElement;

        beforeEach(() => {
            vi.spyOn(window, "matchMedia").mockImplementation((query) => ({
                matches: query === "(max-width: 991px)",
                media: query,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn()
            }) as unknown as MediaQueryList);

            const backdrop = document.body.appendChild(document.createElement("div"));
            backdrop.id = "mobile-sidebar-container";
            tree = document.body.appendChild(document.createElement("div"));
            tree.id = "mobile-sidebar-wrapper";
            detail = document.body.appendChild(document.createElement("div"));
            detail.id = "detail-container";
        });

        afterEach(() => {
            document.body.innerHTML = "";
            document.body.classList.remove("navigation-stack");
        });

        function renderOn(userAgent: string) {
            vi.spyOn(navigator, "userAgent", "get").mockReturnValue(userAgent);
            return render(true);
        }

        it("slides the tree over the note as a drawer", () => {
            const sidebar = renderOn("Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile");
            expect(document.body.classList.contains("navigation-stack")).toBe(false);

            sidebar.activeScreenChangedEvent({ activeScreen: "tree" });
            expect(tree.style.transform).toBe("translateX(0%)");
            expect(detail.style.transform).toBe("");

            sidebar.activeScreenChangedEvent({ activeScreen: "detail" });
            expect(tree.style.transform).toBe("translateX(-100%)");
            expect(detail.style.transform).toBe("");
        });

        it("slides the note off the tree on an iPhone, as a navigation stack", () => {
            const sidebar = renderOn("Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) Mobile");
            expect(document.body.classList.contains("navigation-stack")).toBe(true);

            sidebar.activeScreenChangedEvent({ activeScreen: "tree" });
            expect(detail.style.transform).toBe("translateX(100%)");
            expect(tree.style.transform).toBe("translateX(0%)");

            sidebar.activeScreenChangedEvent({ activeScreen: "detail" });
            expect(detail.style.transform).toBe("translateX(0%)");
            expect(tree.style.transform).toBe("translateX(-30%)");
        });
    });
});
