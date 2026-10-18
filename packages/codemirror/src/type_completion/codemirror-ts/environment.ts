import { combineConfig, Facet } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type ts from "@typescript/vfs";
import { type VirtualTypeScriptEnvironment } from "@typescript/vfs";

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
  },
  {
    path: string;
    env: ts.VirtualTypeScriptEnvironment;
  } | null
>({
  combine(configs) {
    return combineConfig(configs, {});
  },
});

/**
 * Sync updates from CodeMirror to the TypeScript
 * virtual environment. Note that this updates a file - it isn't
 * responsible (yet) for deleting or renaming files if they
 * do get deleted or renamed.
 */
export function tsSync() {
  // TODO: this is a weak solution to the cold start problem.
  // If you boot up a CodeMirror instance, we want the initial
  // value to get loaded into CodeMirror. We do get a change event,
  // but it surprisingly doesn't have `docChanged: true` on it,
  // so this is a rough heuristic to just accept the first event
  // regardless of whether it looks significant.
  let first = true;
  return EditorView.updateListener.of((update) => {
    const config = update.view.state.facet(tsFacet);
    if (!config) return;
    if (!update.docChanged && !first) return;
    first = false;
    createOrUpdateFile(config.env, config.path, update.state.doc.toString() || ' ');
  });
}

/**
 * In TypeScript, updates are not like PUTs, you
 * need to create a file before updating it.
 *
 * This method lets us treat the two as the same.
 */
export function createOrUpdateFile(
  env: VirtualTypeScriptEnvironment,
  path: string,
  code: string,
): void {
  if (!env.getSourceFile(path)) {
    env.createFile(path, code);
  } else {
    env.updateFile(path, code);
  }
}
