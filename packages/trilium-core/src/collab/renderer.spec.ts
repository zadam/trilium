import { describe, expect, it } from "vitest";

import { hasHue } from "./renderer.js";

describe("hasHue", () => {
    it("finds a hue in a colored value and none in grays, white and black", () => {
        for (const color of [ "#ff8800", "#f80", "#00ff0080", "red", "rgb(10 20 30)" ]) {
            expect(hasHue(color), color).toBe(true);
        }

        for (const color of [ "#808080", "#FFF", "#000000ff", "Gray", "white", "transparent" ]) {
            expect(hasHue(color), color).toBe(false);
        }
    });
});
