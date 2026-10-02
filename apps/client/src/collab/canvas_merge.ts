import { CaptureUpdateAction } from "@excalidraw/excalidraw";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { BinaryFileData, ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

type CanvasApi = Pick<ExcalidrawImperativeAPI,
    "getSceneElementsIncludingDeleted" | "updateScene" | "addFiles">;

/**
 * Merges another person's version of a canvas, `theirs`, into the scene the editor shows, keeping
 * the edits made there since `base`. Undo skips the change. Returns false, changing nothing, when
 * `theirs` is no scene.
 */
export function mergeCanvasScene(api: CanvasApi, base: string, theirs: string): boolean {
    const their = readScene(theirs);

    if (!their) {
        return false;
    }

    api.updateScene({
        elements: mergeCanvasElements(readScene(base)?.elements ?? [],
            api.getSceneElementsIncludingDeleted(), their.elements),
        captureUpdate: CaptureUpdateAction.NEVER
    });

    const files = Object.values(their.files ?? {}).filter(
        (file): file is BinaryFileData => !!file && typeof file === "object" && "dataURL" in file);

    if (files.length > 0) {
        api.addFiles(files);
    }

    return true;
}

/**
 * Merges two versions of a canvas's shapes that both started from `base`. A shape both sides have
 * takes its newer version, as Excalidraw's own collaboration decides; a shape only one side has is
 * new there, or deleted on the other side, which wins unless this side changed the shape since.
 * A note's content leaves deleted shapes out, while `mine` keeps them, as the editor does.
 */
export function mergeCanvasElements(
    base: readonly ExcalidrawElement[], mine: readonly ExcalidrawElement[],
    theirs: readonly ExcalidrawElement[]
): ExcalidrawElement[] {
    const inBase = new Map(base.map((element) => [ element.id, element ]));
    const inMine = new Map(mine.map((element) => [ element.id, element ]));
    const inTheirs = new Map(theirs.map((element) => [ element.id, element ]));
    const merged: ExcalidrawElement[] = [];

    for (const element of theirs) {
        const own = inMine.get(element.id);
        const before = inBase.get(element.id);

        if (own) {
            merged.push(isNewer(element, own) ? element : own);
        } else if (!before || element.version > before.version) {
            merged.push(element);
        }
    }

    for (const element of mine) {
        const before = inBase.get(element.id);

        if (!inTheirs.has(element.id) && (!before || element.version > before.version)) {
            merged.push(element);
        }
    }

    return merged.every((element) => typeof element.index === "string")
        ? merged.sort((a, b) => compare(a.index ?? "", b.index ?? ""))
        : merged;
}

/** Whether `a` replaces `b`: a higher version, or the lower nonce of an equal one. */
function isNewer(a: ExcalidrawElement, b: ExcalidrawElement) {
    return a.version > b.version || (a.version === b.version && a.versionNonce < b.versionNonce);
}

function compare(a: string, b: string) {
    if (a === b) {
        return 0;
    }

    return a < b ? -1 : 1;
}

function readScene(content: string):
    { elements: ExcalidrawElement[]; files?: Record<string, unknown> } | null {
    try {
        const scene: unknown = JSON.parse(content);

        if (scene && typeof scene === "object" && "elements" in scene
            && Array.isArray(scene.elements)) {
            return scene as { elements: ExcalidrawElement[]; files?: Record<string, unknown> };
        }
    } catch {
        // Not a scene.
    }

    return null;
}
