import type CodeMirror from "@triliumnext/codemirror";
import { getThemeById } from "@triliumnext/codemirror";

/** The class the share theme puts on `<html>` for a dark page, which its theme switch toggles. */
const DARK_CLASS = "theme-dark";

/** The themes the app gives code notes until its user picks others, by the app's color scheme. */
const CODE_THEME_IDS = { light: "vs-code-light", dark: "vs-code-dark" };

export function isPageDark(): boolean {
    return document.documentElement.classList.contains(DARK_CLASS);
}

/** Calls `apply` each time the page's theme switch turns the page light or dark. */
export function onPageThemeChange(apply: (dark: boolean) => void) {
    let dark = isPageDark();

    new MutationObserver(() => {
        if (isPageDark() !== dark) {
            dark = isPageDark();
            apply(dark);
        }
    }).observe(document.documentElement, { attributes: true, attributeFilter: [ "class" ] });
}

/**
 * Colors a code editor as the app colors code notes by default: with the VS Code light or dark
 * theme of the page's color scheme, switching along with the page.
 */
export function themeCodeEditor(editor: Pick<CodeMirror, "setTheme">) {
    const apply = (dark: boolean) => {
        const theme = getThemeById(dark ? CODE_THEME_IDS.dark : CODE_THEME_IDS.light);

        if (theme) {
            void editor.setTheme(theme);
        }
    };

    apply(isPageDark());
    onPageThemeChange(apply);
}
