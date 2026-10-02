import { describe, expect, it, vi } from "vitest";

// What the sanitizer strips is its own spec's to check, under jsdom (see sanitize.spec.ts).
vi.mock("../../widgets/type_widgets/mind_map/sanitize.js", () => ({
    sanitizeMindMapData: vi.fn(<T>(data: T) => data)
}));

import { sanitizeMindMapData } from "../../widgets/type_widgets/mind_map/sanitize.js";
import { parseMindMap } from "./mind_map_editor.js";

describe("parseMindMap", () => {
    it("cleans a stored map as the app does, and starts a new one for what is not a map", () => {
        const stored = {
            nodeData: { id: "root", topic: "Root", children: [] },
            theme: { name: "Stored" }
        };

        const map = parseMindMap(JSON.stringify(stored), "New topic");
        expect(sanitizeMindMapData).toHaveBeenCalledWith(map);
        expect(map.nodeData.topic).toBe("Root");
        // The editor draws the map in the page's own theme.
        expect(map.theme).toBeUndefined();

        for (const content of [ "", "<p>Was a text note</p>", "[]", "{\"elements\":[]}" ]) {
            expect(parseMindMap(content, "New topic").nodeData.topic, content).toBe("New topic");
        }
        expect(sanitizeMindMapData).toHaveBeenCalledTimes(1);
    });
});
