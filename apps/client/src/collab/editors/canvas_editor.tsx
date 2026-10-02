import "@excalidraw/excalidraw/index.css";
import "./canvas_editor.css";

import {
    CaptureUpdateAction, Excalidraw, exportToSvg, getSceneVersion
} from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type {
    AppState, BinaryFileData, BinaryFiles, ExcalidrawImperativeAPI, ExcalidrawInitialDataState
} from "@excalidraw/excalidraw/types";
import { render } from "preact";

import type { EditorHandle } from "../../collab_editor.js";
import type { GuestSaver } from "../guest_saver.js";
import { isPageDark, onPageThemeChange } from "../page_theme.js";

/** What a canvas note holds, as the app's `CanvasContent` describes it. */
interface CanvasScene {
    elements: ExcalidrawElement[];
    files?: BinaryFiles;
    appState?: Partial<AppState>;
}

/** No image tool, and neither loading a scene from a file nor saving one to it. */
const UI_OPTIONS = {
    tools: { image: false },
    canvasActions: { loadScene: false, saveToActiveFile: false }
};

/** The app state a canvas keeps, which changes no element and so no scene version. */
type KeptAppState = Pick<AppState, "gridModeEnabled" | "viewBackgroundColor">;

/**
 * The guest page's canvas editor: Excalidraw, loading and saving the scene as the app does.
 * Guests cannot add pictures, since a picture is stored as an attachment, so the image tool is
 * off; the pictures the canvas holds load through the guest routes. The SVG the app stores of a
 * canvas is the preview that the saver sends with the content.
 */
export default function mountCanvasEditor(
    host: HTMLElement, content: string, saver: GuestSaver, noteId: string
): EditorHandle {
    host.classList.add("collab-canvas-host");
    host.replaceChildren();
    // The app serves Excalidraw's fonts from its root, two levels above every guest page.
    window.EXCALIDRAW_ASSET_PATH = new URL(
        "../../node_modules/@excalidraw/excalidraw/dist/prod/", location.href).href;

    const theme = isPageDark() ? "dark" : "light";
    const scene = parseCanvasScene(content);
    const pictureIds = new Set<string>();
    let api: ExcalidrawImperativeAPI | null = null;
    let sceneVersion = getSceneVersion(scene.elements);
    // Recorded at each save, as the app does: until then, only the scene tells of an edit.
    let keptAppState: Partial<KeptAppState> | null = null;
    // Until Excalidraw applies the loaded scene, the empty one it starts with is no edit (#10279).
    let sceneApplied = sceneVersion === 0;

    const initialData: Promise<ExcalidrawInitialDataState> = loadPictures(noteId)
        .then((pictures) => {
            const files: BinaryFiles = { ...scene.files };

            for (const picture of pictures) {
                files[picture.id] = picture;
                pictureIds.add(picture.id);
            }

            return { elements: scene.elements, appState: { ...scene.appState, theme }, files };
        });

    const serialize = () => {
        if (!api) {
            return content;
        }

        const appState = api.getAppState();
        keptAppState = getKeptAppState(appState);

        return serializeCanvasScene(api.getSceneElements(), appState, api.getFiles(), pictureIds);
    };

    const onChange = () => {
        if (!api) {
            return;
        }

        const version = getSceneVersion(api.getSceneElements());

        if (!sceneApplied) {
            if (version === 0) {
                return;
            }

            sceneApplied = true;
        }

        const appState = getKeptAppState(api.getAppState());
        const appStateChanged = keptAppState !== null
            && (appState.gridModeEnabled !== keptAppState.gridModeEnabled
                || appState.viewBackgroundColor !== keptAppState.viewBackgroundColor);

        if (version === sceneVersion && !appStateChanged) {
            return;
        }

        sceneVersion = version;
        saver.scheduleContent(serialize);
    };

    const draw = (pageTheme: "light" | "dark") => render(
        <Excalidraw
            initialData={initialData}
            excalidrawAPI={setApi}
            onChange={onChange}
            theme={pageTheme}
            UIOptions={UI_OPTIONS}
            onLinkOpen={openLink}
        />, host);
    const setApi = (instance: ExcalidrawImperativeAPI) => {
        api = instance;
    };

    draw(theme);
    // Drawn again with the other theme, Excalidraw keeps its scene and only changes colors.
    onPageThemeChange((dark) => draw(dark ? "dark" : "light"));

    saver.preview = async () => {
        if (!api) {
            return null;
        }

        // As the app draws its preview of a canvas.
        const svg = await exportToSvg({
            elements: api.getSceneElements(),
            appState: api.getAppState(),
            exportPadding: 5,
            files: api.getFiles()
        });

        return svg.outerHTML;
    };

    return {
        get: serialize,
        set: (text) => {
            if (!api) {
                return;
            }

            const next = parseCanvasScene(text);
            api.updateScene({ elements: next.elements, captureUpdate: CaptureUpdateAction.NEVER });
            api.addFiles(Object.values(next.files ?? {}));
            // The scene the server holds is no edit to save back.
            sceneVersion = getSceneVersion(api.getSceneElements());
        },
        focusStart: () => host.querySelector<HTMLElement>(".excalidraw")?.focus()
    };
}

/** The scene a canvas note holds, or an empty one for content that is not a scene. */
export function parseCanvasScene(content: string): CanvasScene {
    try {
        const scene: unknown = JSON.parse(content);

        if (scene && typeof scene === "object" && "elements" in scene
            && Array.isArray(scene.elements)) {
            return scene as CanvasScene;
        }
    } catch {
        // Not a scene, as after a switch from another type: the editor starts an empty one.
    }

    return { elements: [], files: {}, appState: {} };
}

/**
 * The content the app saves for a canvas. The app moves every picture into an attachment, which
 * a guest cannot create, so a picture the canvas shows that no attachment holds stays inline in
 * `files`, as in the canvases the app made before it kept pictures as attachments.
 */
export function serializeCanvasScene(
    elements: readonly ExcalidrawElement[], appState: AppState, files: BinaryFiles,
    pictureIds: ReadonlySet<string>
): string {
    const inlineFiles: BinaryFiles = {};

    for (const element of elements) {
        const fileId = "fileId" in element ? element.fileId : null;

        if (fileId && !pictureIds.has(fileId) && files[fileId]) {
            inlineFiles[fileId] = files[fileId];
        }
    }

    return JSON.stringify({
        type: "excalidraw",
        version: 2,
        elements,
        files: inlineFiles,
        appState: {
            scrollX: appState.scrollX,
            scrollY: appState.scrollY,
            zoom: appState.zoom,
            ...getKeptAppState(appState)
        }
    });
}

/** A link to a note of the host's app leads nowhere on the guest page, so it is not followed. */
function openLink(element: { link: string | null }, event: CustomEvent) {
    if (/^#?root\//.test(element.link ?? "")) {
        event.preventDefault();
    }
}

function getKeptAppState(appState: Partial<AppState>): Partial<KeptAppState> {
    return {
        gridModeEnabled: appState.gridModeEnabled,
        viewBackgroundColor: appState.viewBackgroundColor
    };
}

/**
 * The canvas's pictures: its image attachments, each named by the Excalidraw file id it backs, as
 * the app's `loadImageAttachments` reads them.
 */
async function loadPictures(noteId: string): Promise<BinaryFileData[]> {
    try {
        const response = await fetch(
            `api/notes/${encodeURIComponent(noteId)}/image-attachments`,
            { credentials: "same-origin" });

        if (!response.ok) {
            return [];
        }

        const attachments = await response.json() as { attachmentId: string; title: string }[];
        const pictures = await Promise.all(attachments.map(loadPicture));

        return pictures.filter((picture): picture is BinaryFileData => picture !== null);
    } catch {
        return [];
    }
}

async function loadPicture(
    { attachmentId, title }: { attachmentId: string; title: string }
): Promise<BinaryFileData | null> {
    const url = `api/attachments/${encodeURIComponent(attachmentId)}/image/`
        + encodeURIComponent(title);
    const response = await fetch(url, { credentials: "same-origin" });

    if (!response.ok) {
        return null;
    }

    const blob = await response.blob();

    return {
        id: title,
        dataURL: await readDataUrl(blob),
        mimeType: blob.type || "image/png",
        created: Date.now()
    } as BinaryFileData;
}

function readDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
    });
}
