// From: https://github.com/codemirror/autocomplete/blob/53cc58393252659ac4a86162b40afef13eeb2241/src/completion.ts#L245
// TODO: do we need this, or can use import it from codemirror?
export function ensureAnchor(expr: RegExp, start: boolean) {
  let { source } = expr;
  let addStart = start && source[0] != "^",
    addEnd = source[source.length - 1] != "$";
  if (!addStart && !addEnd) return expr;
  return new RegExp(
    `${addStart ? "^" : ""}(?:${source})${addEnd ? "$" : ""}`,
    expr.flags ?? (expr.ignoreCase ? "i" : ""),
  );
}
