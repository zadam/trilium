import { linter, Diagnostic } from "@codemirror/lint";
import { getLints } from "./getLints.js";
import { tsFacet } from "../facet/tsFacet.js";

/**
 * Binds the TypeScript `lint()` method with TypeScript's
 * semantic and syntactic diagnostics. You can use
 * the `getLints` method for a lower-level interface
 * to the same data.
 */
export function tsLinter({
  diagnosticCodesToIgnore,
}: { diagnosticCodesToIgnore?: number[] } = {}) {
  return linter(async (view): Promise<readonly Diagnostic[]> => {
    const config = view.state.facet(tsFacet);
    return config
      ? getLints({
          ...config,
          diagnosticCodesToIgnore: diagnosticCodesToIgnore || [],
        })
      : [];
  });
}
