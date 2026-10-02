import { describe, expect, it } from "vitest";

import {
    COLLAB_PERSON_COLOR_NAMES, COLLAB_PERSON_COLORS, MAX_COLLAB_NAME_LENGTH, normalizeCollabColor,
    normalizeCollabName, parseCollabSelection
} from "./collab.js";

describe("normalizeCollabName", () => {
    it("keeps a name readable and short, dropping what could disguise it", () => {
        expect(normalizeCollabName("  Ada   Lovelace \n")).toBe("Ada Lovelace");
        // A right-to-left override would draw the rest of a row backwards.
        expect(normalizeCollabName("‮evil‬ name​")).toBe("evil name");
        expect(normalizeCollabName("tab\there\u0000")).toBe("tab here");
        expect(normalizeCollabName("x".repeat(60))).toHaveLength(MAX_COLLAB_NAME_LENGTH);
        // A character outside the basic plane counts once and is never cut in half.
        expect(normalizeCollabName("😀".repeat(50))).toBe("😀".repeat(MAX_COLLAB_NAME_LENGTH));

        for (const empty of [ "", "   ", "​‮", 42, null, undefined, {} ]) {
            expect(normalizeCollabName(empty), String(empty)).toBeNull();
        }
    });
});

describe("normalizeCollabColor", () => {
    it("takes a palette color in any letter case and nothing else", () => {
        expect(normalizeCollabColor("#D22A1E")).toBe("#d22a1e");
        expect(COLLAB_PERSON_COLORS.map(normalizeCollabColor)).toEqual([ ...COLLAB_PERSON_COLORS ]);

        for (const other of [ "#123456", "red", "#d22a1e; background: url(x)", null, 42 ]) {
            expect(normalizeCollabColor(other), String(other)).toBeNull();
        }
    });
});

describe("parseCollabSelection", () => {
    it("keeps only a selection's own fields and refuses anything else", () => {
        expect(parseCollabSelection({ kind: "code", anchor: 3, head: 9, extra: "x".repeat(1000) }))
            .toEqual({ kind: "code", anchor: 3, head: 9 });
        expect(parseCollabSelection({ kind: "text", anchor: [ 1, 4 ], head: [ 2, 0 ], extra: 1 }))
            .toEqual({ kind: "text", anchor: [ 1, 4 ], head: [ 2, 0 ] });
        // A canvas pointer is a point of the scene, which can lie left of or above its origin.
        expect(parseCollabSelection({ kind: "canvas", x: -120.5, y: 48, tool: "laser" }))
            .toEqual({ kind: "canvas", x: -120.5, y: 48 });

        for (const invalid of [
            null, "code", [ 1, 2 ],
            { kind: "code", anchor: -1, head: 0 },
            { kind: "code", anchor: 1.5, head: 2 },
            { kind: "code", anchor: 1e9, head: 0 },
            { kind: "code", anchor: "1", head: 1 },
            { kind: "canvas", x: Number.NaN, y: 0 },
            { kind: "canvas", x: Number.POSITIVE_INFINITY, y: 0 },
            { kind: "canvas", x: 0, y: 1e12 },
            { kind: "canvas", x: "0", y: 0 },
            { kind: "text", anchor: [], head: [ 0 ] },
            { kind: "text", anchor: [ 0 ], head: 0 },
            { kind: "text", anchor: Array(17).fill(0), head: [ 0 ] },
            { kind: "text", anchor: [ 0, Number.NaN ], head: [ 0 ] },
            { kind: "image", anchor: 0, head: 0 }
        ]) {
            expect(parseCollabSelection(invalid), JSON.stringify(invalid)).toBeNull();
        }
    });
});

describe("COLLAB_PERSON_COLORS", () => {
    it("carries white text and stands out on a dark page, each color its own", () => {
        for (const color of COLLAB_PERSON_COLORS) {
            expect(contrast(color, "#ffffff"), color).toBeGreaterThanOrEqual(4.5);
            expect(contrast(color, "#1e1e1e"), color).toBeGreaterThanOrEqual(3);
        }

        expect(new Set(COLLAB_PERSON_COLORS).size).toBe(COLLAB_PERSON_COLORS.length);
        expect(COLLAB_PERSON_COLOR_NAMES).toHaveLength(COLLAB_PERSON_COLORS.length);
    });
});

/** The WCAG contrast ratio between two `#rrggbb` colors. */
function contrast(first: string, second: string) {
    const [ lighter, darker ] = [ luminance(first), luminance(second) ].sort((a, b) => b - a);

    return (lighter + 0.05) / (darker + 0.05);
}

function luminance(hex: string) {
    const [ red, green, blue ] = [ 1, 3, 5 ].map((start) => {
        const channel = parseInt(hex.slice(start, start + 2), 16) / 255;

        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });

    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
