import { ensureAnchor } from "./ensureAnchor.js";
import { getLineAtPosition } from "./getLineAtPosition.js";

// From: https://github.com/codemirror/autocomplete/blob/53cc58393252659ac4a86162b40afef13eeb2241/src/completion.ts#L111
// TODO: do we need to vendor this?
export function matchBefore(code: string, pos: number, expr: RegExp) {
  const line = getLineAtPosition(code, pos);
  let start = Math.max(line.from, pos - 250);
  let str = line.text.slice(start - line.from, pos - line.from);
  let found = str.search(ensureAnchor(expr, false));
  return found < 0
    ? null
    : { from: start + found, to: pos, text: str.slice(found) };
}
