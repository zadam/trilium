import { test, expect } from "vitest";
import { getLineAtPosition } from "./getLineAtPosition.js";

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
