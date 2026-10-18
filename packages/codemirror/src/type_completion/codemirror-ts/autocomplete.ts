import type {
  Completion,
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";
import ts from "typescript";
import { type VirtualTypeScriptEnvironment } from "@typescript/vfs";
import { tsFacet } from "./environment.js";
import { AUTOCOMPLETION_SYMBOLS } from "./symbols.js";

/**
 * Create a `CompletionSource` that queries
 * the _on-thread_ TypeScript environments for autocompletions
 * at this character.
 */
export function tsAutocomplete(): CompletionSource {
  return async (
    context: CompletionContext,
  ): Promise<CompletionResult | null> => {
    const config = context.state.facet(tsFacet);
    if (!config) return null;
    return getAutocompletion({
      ...config,
      context,
    });
  };
}

const TS_COMPLETE_BLOCKLIST: ts.ScriptElementKind[] = [
  ts.ScriptElementKind.warning,
];

export async function getAutocompletion({
  env,
  path,
  context,
  keepLegacyLimitationForAutocompletionSymbols = true,
}: {
  env: VirtualTypeScriptEnvironment;
  path: string;
  keepLegacyLimitationForAutocompletionSymbols?: boolean;
  /**
   * Allow this to be a subset of the full CompletionContext
   * object, because the raw object isn't serializable.
   */
  context: Pick<CompletionContext, "pos" | "explicit">;
}): Promise<CompletionResult | null> {
  const { pos, explicit } = context;
  const rawContents = env.getSourceFile(path)?.getFullText();

  if (!rawContents) return null;

  // If there's space behind the cursor, don't try and autocomplete.
  // https://codemirror.net/examples/autocompletion/
  let word = matchBefore(rawContents, pos, /\w*/);
  if (!word?.text) {
    word = matchBefore(rawContents, pos, /\./);
  }

  if (!word?.text && !explicit) return null;

  const completionInfo = env.languageService.getCompletionsAtPosition(
    path,
    pos,
    {},
    {},
  );

  // TODO: build ATA support for a 'loading' state
  // while types are being fetched
  if (!completionInfo) return null;

  const options = completionInfo.entries
    .filter(
      (entry) =>
        !TS_COMPLETE_BLOCKLIST.includes(entry.kind) &&
        (entry.sortText < "15" ||
          (completionInfo.optionalReplacementSpan?.length &&
            (!keepLegacyLimitationForAutocompletionSymbols || AUTOCOMPLETION_SYMBOLS.includes(entry.name)))),
    )
    .map((entry): Completion => {
      const boost = -Number(entry.sortText) || 0;
      let type = entry.kind ? String(entry.kind) : undefined;

      if (type === "member") type = "property";

      if (type && !DEFAULT_CODEMIRROR_TYPE_ICONS.has(type)) {
        type = undefined;
      }

      return {
        label: entry.name,
        type,
        boost,
      };
    });

  return {
    from: word ? (word.text === "." ? word.to : word.from) : pos,
    options,
  };
}

/**
 * There is some overlap between CodeMirror's
 * types and TypeScripts. This is all of the default
 * icons for CodeMirror: if TypeScript gives us one
 * of these, we pass it through.
 */
export const DEFAULT_CODEMIRROR_TYPE_ICONS = new Set([
  `class`,
  `constant`,
  `enum`,
  `function`,
  `interface`,
  `keyword`,
  `method`,
  `namespace`,
  `property`,
  `text`,
  `type`,
  `variable`,
]);

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

/**
 * TODO: confirm that this is necessary; it may be possible
 * and more efficient to get the line from CodeMirror, though
 * that would mean it probably doesn't mix well with the approach
 * of persisting code in the TS enviroment.
 */
export function getLineAtPosition(code: string, position: number) {
  // lineStart is the index of line break or zero
  const from = code.lastIndexOf("\n", position - 1) + 1;
  let to = code.indexOf("\n", position);
  if (to === -1) {
    to = code.length;
  }
  const text = code.slice(from, to);
  return {
    from,
    to,
    text,
  };
}
