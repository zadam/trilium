import { combineConfig, Facet } from "@codemirror/state";
import type ts from "@typescript/vfs";

/**
 * This is how the ts-related extensions are
 * configured: this facet sets the path of the file
 * and the environment to use, and the rest of
 * the extensions, like tsLint and tsAutocomplete,
 * pull those settings automatically from editor state.
 */
export const tsFacet = Facet.define<
  {
    path: string;
    env: ts.VirtualTypeScriptEnvironment;
    keepLegacyLimitationForAutocompletionSymbols?: boolean;
  },
  {
    path: string;
    env: ts.VirtualTypeScriptEnvironment;
    keepLegacyLimitationForAutocompletionSymbols?: boolean;
  } | null
>({
  combine(configs) {
    return combineConfig(configs, {});
  },
});
