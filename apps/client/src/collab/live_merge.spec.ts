import { describe, expect, it } from "vitest";

import { applyTextChanges, mergeText, textChanges } from "./live_merge.js";

describe("textChanges", () => {
    it("describes the edits between two texts as replacements in the first", () => {
        expect(textChanges("hello world", "hello world")).toEqual([]);
        expect(textChanges("hello world", "hello big world!")).toEqual([
            { from: 6, to: 6, insert: "big " }, { from: 11, to: 11, insert: "!" }
        ]);
        expect(textChanges("<p>abc</p>", "<p>ac</p>")).toEqual([ { from: 4, to: 5, insert: "" } ]);

        for (const [ before, after ] of [
            [ "", "new" ], [ "gone", "" ], [ "😀 a", "😀 b 😀" ], [ "abcabc", "cbacba" ]
        ]) {
            expect(applyTextChanges(before, textChanges(before, after)), after).toBe(after);
        }
    });
});

describe("mergeText", () => {
    const base = "<p>The quick fox</p><p>jumps over the dog</p>";

    it("keeps both people's edits when they touch different places", () => {
        const mine = "<p>The quick brown fox</p><p>jumps over the dog</p>";
        const theirs = "<p>The quick fox</p><p>jumps over the lazy dog</p>";

        expect(mergeText(base, mine, theirs))
            .toBe("<p>The quick brown fox</p><p>jumps over the lazy dog</p>");
        // Deleting next to the other person's typing.
        expect(mergeText("abcdef", "abef", "abcdXef")).toBe("abXef");
    });

    it("takes one side as is when the other has not changed, or both made the same edit", () => {
        expect(mergeText(base, base, "theirs")).toBe("theirs");
        expect(mergeText(base, "mine", base)).toBe("mine");
        expect(mergeText(base, "same", "same")).toBe("same");
        // My save already reached the other side, which typed on after it.
        expect(mergeText("ab", "aXb", "aXbY")).toBe("aXbY");
    });

    it("puts the other person's text first when both type at the same place", () => {
        expect(mergeText("ab", "aMb", "aTb")).toBe("aTMb");
    });

    it("joins overlapping deletions", () => {
        expect(mergeText("abcdefgh", "abfgh", "abcdh")).toBe("abh");
    });

    it("gives up when both changed the same text differently", () => {
        expect(mergeText("the cat", "the dog", "the cow")).toBeNull();
        // Typing inside text the other person deleted.
        expect(mergeText("abcdef", "abcXdef", "af")).toBeNull();
    });
});
