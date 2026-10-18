import { test, expect } from "vitest";
import { ensureAnchor } from "./ensureAnchor.js";

test("ensureAnchor", () => {
  expect(ensureAnchor(/hi/, false)).toEqual(/(?:hi)$/);
  expect(ensureAnchor(/hi$/, false)).toEqual(/hi$/);
  expect(ensureAnchor(/hi$/, true)).toEqual(/^(?:hi$)/);
  expect(ensureAnchor(/^hi$/, true)).toEqual(/^hi$/);
});
