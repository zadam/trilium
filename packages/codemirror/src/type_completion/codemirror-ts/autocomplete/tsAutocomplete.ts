import type {
  CompletionContext,
  CompletionResult,
  CompletionSource,
} from "@codemirror/autocomplete";
import { getAutocompletion } from "./getAutocompletion.js";
import { tsFacet } from "../facet/tsFacet.js";

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
