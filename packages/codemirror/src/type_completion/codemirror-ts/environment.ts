import { combineConfig, type EditorState, Facet } from "@codemirror/state";
import { type EditorView, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import type ts from "@typescript/vfs";
import { type VirtualTypeScriptEnvironment } from "@typescript/vfs";

/**
 * This is how the ts-related extensions are
 * configured: this facet sets the path of the file
 * and the environment to use, and the rest of
 * the extensions, tsSync, tsLinter and tsHover,
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
  // The plugin is constructed whenever it joins an editor, at creation or through a
  // reconfiguration, so the document the editor already holds is synced then.
  return ViewPlugin.fromClass(class {
    constructor(view: EditorView) {
      syncDocument(view.state);
    }

    update(update: ViewUpdate) {
      if (update.docChanged) syncDocument(update.state);
    }
  });
}

function syncDocument(state: EditorState) {
  const config = state.facet(tsFacet);
  if (!config) return;
  createOrUpdateFile(config.env, config.path, state.doc.toString() || ' ');
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
