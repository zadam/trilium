import { expect, test } from "vitest";
import { ensureAnchor, getLineAtPosition, matchBefore } from "./autocomplete.js";

test("matchBefore", () => {
  expect(matchBefore("hi.", 0, /\./)).toEqual(null);
  expect(matchBefore("hi.", 3, /\./)).toEqual({
    from: 2,
    text: ".",
    to: 3,
  });
});

test("ensureAnchor", () => {
  expect(ensureAnchor(/hi/, false)).toEqual(/(?:hi)$/);
  expect(ensureAnchor(/hi$/, false)).toEqual(/hi$/);
  expect(ensureAnchor(/hi$/, true)).toEqual(/^(?:hi$)/);
  expect(ensureAnchor(/^hi$/, true)).toEqual(/^hi$/);
});

test("getLineAtPosition", () => {
  expect(getLineAtPosition("x", 0)).toEqual({
    from: 0,
    text: "x",
    to: 1,
  });

  expect(getLineAtPosition("x", 10)).toEqual({
    from: 0,
    text: "x",
    to: 1,
  });

  expect(getLineAtPosition("x", -10)).toEqual({
    from: 0,
    text: "x",
    to: 1,
  });

  expect(getLineAtPosition("first line\nsecond line", 12)).toEqual({
    from: 11,
    text: "second line",
    to: 22,
  });
});
