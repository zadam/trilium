import { expect, test } from "vitest";
import { matchBefore } from "./matchBefore.js";

test("matchBefore", () => {
  expect(matchBefore("hi.", 0, /\./)).toEqual(null);
  expect(matchBefore("hi.", 3, /\./)).toEqual({
    from: 2,
    text: ".",
    to: 3,
  });
});
