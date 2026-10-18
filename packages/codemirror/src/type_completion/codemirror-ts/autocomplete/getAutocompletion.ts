import type {
  CompletionContext,
  Completion,
  CompletionResult,
} from "@codemirror/autocomplete";
import ts from "typescript";
import { type VirtualTypeScriptEnvironment } from "@typescript/vfs";
import { AUTOCOMPLETION_SYMBOLS } from "./symbols.js";
import { DEFAULT_CODEMIRROR_TYPE_ICONS } from "./icons.js";
import { matchBefore } from "./matchBefore.js";

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
