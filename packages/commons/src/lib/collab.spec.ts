import { describe, expect, it } from "vitest";

import {
    COLLAB_PERSON_COLORS, MAX_COLLAB_NAME_LENGTH, normalizeCollabName, parseCollabSelection
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

describe("parseCollabSelection", () => {
    it("keeps only a selection's own fields and refuses anything else", () => {
        expect(parseCollabSelection({ kind: "code", anchor: 3, head: 9, extra: "x".repeat(1000) }))
            .toEqual({ kind: "code", anchor: 3, head: 9 });
        expect(parseCollabSelection({ kind: "text", anchor: [ 1, 4 ], head: [ 2, 0 ], extra: 1 }))
            .toEqual({ kind: "text", anchor: [ 1, 4 ], head: [ 2, 0 ] });

        for (const invalid of [
            null, "code", [ 1, 2 ],
            { kind: "code", anchor: -1, head: 0 },
            { kind: "code", anchor: 1.5, head: 2 },
            { kind: "code", anchor: 1e9, head: 0 },
            { kind: "code", anchor: "1", head: 1 },
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
