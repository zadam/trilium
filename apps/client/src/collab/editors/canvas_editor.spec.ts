import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState, BinaryFiles } from "@excalidraw/excalidraw/types";
import { describe, expect, it, vi } from "vitest";

vi.mock("@excalidraw/excalidraw", () => ({
    Excalidraw: () => null,
    exportToSvg: vi.fn(),
    getSceneVersion: vi.fn(() => 0),
    CaptureUpdateAction: { NEVER: "NEVER" }
}));

import { parseCanvasScene, serializeCanvasScene } from "./canvas_editor.js";

describe("canvas scene", () => {
    it("reads a stored scene, and an empty one from what is not a scene", () => {
        const stored = { type: "excalidraw", elements: [ { id: "a" } ], files: {}, appState: {} };
        expect(parseCanvasScene(JSON.stringify(stored)).elements).toEqual([ { id: "a" } ]);

        for (const content of [ "", "<p>Was a text note</p>", "{\"nodeData\":{}}" ]) {
            expect(parseCanvasScene(content).elements, content).toEqual([]);
        }
    });

    it("saves as the app does, keeping inline only the pictures no attachment holds", () => {
        const elements = [
            { id: "r", type: "rectangle" },
            { id: "i1", type: "image", fileId: "held" },
            { id: "i2", type: "image", fileId: "inline" }
        ] as unknown as ExcalidrawElement[];
        const files = {
            held: { id: "held", dataURL: "data:image/png;base64,AA" },
            inline: { id: "inline", dataURL: "data:image/png;base64,BB" },
            unused: { id: "unused", dataURL: "data:image/png;base64,CC" }
        } as unknown as BinaryFiles;
        const appState = {
            scrollX: 10, scrollY: 20, zoom: { value: 1 }, gridModeEnabled: true,
            viewBackgroundColor: "#fff", selectedElementIds: { r: true }
        } as unknown as AppState;

        const held = new Set([ "held" ]);
        const saved = JSON.parse(serializeCanvasScene(elements, appState, files, held));

        expect(saved).toMatchObject({ type: "excalidraw", version: 2, elements });
        expect(Object.keys(saved.files)).toEqual([ "inline" ]);
        expect(saved.appState).toEqual({
            scrollX: 10, scrollY: 20, zoom: { value: 1 }, gridModeEnabled: true,
            viewBackgroundColor: "#fff"
        });
    });
});
