import "./mermaid_editor.css";

import CodeMirror from "@triliumnext/codemirror";

import type { EditorHandle } from "../../collab_editor.js";
import { renderMermaidSvg } from "../../services/mermaid.js";
import mermaidLinter from "../../widgets/type_widgets/linters/mermaid.js";
import { codeCursorAdapter } from "../cursor_sync.js";
import type { GuestSaver } from "../guest_saver.js";
import { mergeCode } from "../live_merge.js";
import { isPageDark, onPageThemeChange, themeCodeEditor } from "../page_theme.js";

/** How long the diagram waits after the last keystroke before it is drawn again. */
const DRAW_DELAY_MS = 500;

export interface DiagramLabels {
    placeholder: string;
    preview: string;
    views: Record<DiagramView, string>;
}

/** What the diagram editor shows: the source, the source beside the diagram, or the diagram. */
export type DiagramView = "source" | "split" | "preview";

/** The app's buttons for the three display modes, in its order and with its icons. */
const VIEWS: { view: DiagramView; icon: string }[] = [
    { view: "source", icon: "bx bx-code" },
    { view: "split", icon: "bx bxs-dock-left" },
    { view: "preview", icon: "bx bx-show" }
];

/** Where the page keeps the display mode a guest picked, for the rest of the browser tab. */
const VIEW_KEY = "collab-diagram-view";

/** The Mermaid themes a guest's diagram is drawn in. */
export type DiagramTheme = "default" | "dark";

/**
 * The guest page's diagram editor: the Mermaid source in CodeMirror beside the diagram it draws,
 * as the app's diagram editor lays them out, both in the page's light or dark theme. The preview
 * that the saver sends with the content is drawn in Mermaid's default theme, so viewers see the
 * same picture in either theme.
 */
export default function mountMermaidEditor(
    host: HTMLElement, content: string, saver: GuestSaver, labels: DiagramLabels
): EditorHandle {
    host.classList.add("collab-mermaid-host");
    const source = document.createElement("div");
    source.className = "collab-mermaid-source";
    const diagram = document.createElement("div");
    diagram.className = "collab-mermaid-diagram";
    diagram.setAttribute("role", "img");
    diagram.setAttribute("aria-label", labels.preview);
    host.replaceChildren(source, diagram);
    mountDiagramViews(host, labels.views);

    const draw = createDiagramDrawer(renderMermaidSvg);
    let applyingRemote = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const pageTheme = (): DiagramTheme => (isPageDark() ? "dark" : "default");
    const show = async () => {
        const text = editor.getText();
        const theme = pageTheme();
        const drawing = await draw(text, theme);

        // A newer edit, or a switch of the page's theme, draws its own diagram.
        if (text !== editor.getText() || theme !== pageTheme()) {
            return;
        }

        diagram.classList.toggle("collab-mermaid-error", drawing.error !== null);

        if (drawing.error !== null) {
            diagram.textContent = drawing.error;
        } else {
            diagram.innerHTML = drawing.svg;
        }
    };

    const editor = new CodeMirror({
        parent: source,
        lineWrapping: true,
        placeholder: labels.placeholder,
        onContentChanged: () => {
            clearTimeout(timer);
            timer = setTimeout(() => void show(), DRAW_DELAY_MS);

            if (!applyingRemote) {
                saver.scheduleContent(() => editor.getText());
            }
        }
    });
    const set = (text: string) => {
        applyingRemote = true;

        try {
            editor.setText(text);
        } finally {
            applyingRemote = false;
        }
    };

    set(content);
    void editor.setMimeType("text/mermaid");
    editor.setNamedExtension("mermaid-lint", mermaidLinter());
    themeCodeEditor(editor);
    void show();
    onPageThemeChange(() => void show());

    saver.preview = async (text) => {
        const drawing = await draw(text, "default");
        return drawing.error === null && drawing.svg ? drawing.svg : null;
    };

    return {
        get: () => editor.getText(),
        set,
        merge: (base, theirs) => mergeCode(editor, base, theirs, (apply) => {
            applyingRemote = true;

            try {
                apply();
            } finally {
                applyingRemote = false;
            }
        }),
        focusStart: () => editor.focus(),
        cursors: codeCursorAdapter(editor)
    };
}

export type DiagramDrawing = { svg: string; error: null } | { svg: null; error: string };

/**
 * Draws each source once per theme, for the diagram beside the editor and for the preview of the
 * save that follows it alike, keeping the latest source of each theme. The drawings run one at a
 * time, because Mermaid keeps the theme it draws in for the whole page.
 */
export function createDiagramDrawer(
    render: (source: string, theme: DiagramTheme) => Promise<string>
) {
    const latest = new Map<DiagramTheme, { source: string; drawing: Promise<DiagramDrawing> }>();
    let queue: Promise<unknown> = Promise.resolve();

    return (source: string, theme: DiagramTheme): Promise<DiagramDrawing> => {
        const kept = latest.get(theme);

        if (kept?.source === source) {
            return kept.drawing;
        }

        const drawing = queue.then(() => render(source, theme)).then(
            (svg): DiagramDrawing => ({ svg, error: null }),
            (error: unknown): DiagramDrawing => ({
                svg: null,
                error: error instanceof Error ? error.message : String(error)
            }));
        queue = drawing;
        latest.set(theme, { source, drawing });

        return drawing;
    };
}

/**
 * Puts the app's display mode buttons beside the note options button: the source alone, the
 * source beside the diagram, or the diagram alone. The view is split until a guest picks another,
 * which then holds for the rest of the browser tab.
 */
export function mountDiagramViews(host: HTMLElement, labels: Record<DiagramView, string>) {
    const group = document.createElement("div");
    group.className = "collab-view-modes";
    group.setAttribute("role", "group");

    const buttons = VIEWS.map(({ view, icon }) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = `collab-view-mode ${icon}`;
        button.title = labels[view];
        button.setAttribute("aria-label", labels[view]);
        button.addEventListener("click", () => {
            show(view);

            try {
                sessionStorage.setItem(VIEW_KEY, view);
            } catch {
                // Without session storage, the choice holds until the page reloads.
            }
        });
        group.append(button);

        return { view, button };
    });

    const show = (view: DiagramView) => {
        host.dataset.view = view;

        for (const entry of buttons) {
            entry.button.setAttribute("aria-pressed", String(entry.view === view));
        }
    };

    show(readStoredView());

    const options = document.querySelector(".collab-note-options");

    if (options) {
        options.before(group);
    } else {
        host.before(group);
    }
}

function readStoredView(): DiagramView {
    try {
        const stored = sessionStorage.getItem(VIEW_KEY);
        const view = VIEWS.find((entry) => entry.view === stored);

        return view?.view ?? "split";
    } catch {
        return "split";
    }
}
