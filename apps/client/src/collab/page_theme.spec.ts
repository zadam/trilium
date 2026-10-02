import { afterEach, describe, expect, it, vi } from "vitest";

import { isPageDark, onPageThemeChange, themeCodeEditor } from "./page_theme.js";

/** Flips the page's theme as the share theme's switch does, and lets the observers run. */
async function switchTheme(theme: "light" | "dark") {
    const root = document.documentElement;
    root.classList.toggle("theme-dark", theme === "dark");
    root.classList.toggle("theme-light", theme === "light");
    await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("page theme", () => {
    afterEach(() => {
        document.documentElement.className = "";
    });

    it("tells light from dark and reports each switch once", async () => {
        await switchTheme("dark");
        expect(isPageDark()).toBe(true);

        const seen: boolean[] = [];
        onPageThemeChange((dark) => seen.push(dark));
        await switchTheme("light");
        // A class change that keeps the theme is no switch.
        document.documentElement.classList.add("menu-open");
        await switchTheme("light");
        await switchTheme("dark");
        expect(seen).toEqual([ false, true ]);
    });

    it("colors a code editor with the app's default code theme, following the switch", async () => {
        await switchTheme("dark");
        const setTheme = vi.fn(async () => {});

        themeCodeEditor({ setTheme });
        expect(setTheme).toHaveBeenLastCalledWith(expect.objectContaining({ id: "vs-code-dark" }));

        await switchTheme("light");
        expect(setTheme).toHaveBeenLastCalledWith(expect.objectContaining({ id: "vs-code-light" }));
        expect(setTheme).toHaveBeenCalledTimes(2);
    });
});
