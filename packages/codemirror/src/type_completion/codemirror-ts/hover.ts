import { EditorView, hoverTooltip, Tooltip, TooltipView } from "@codemirror/view";
import type ts from "typescript";
import { type VirtualTypeScriptEnvironment } from "@typescript/vfs";
import { tsFacet } from "./environment.js";

/**
 * This binds the CodeMirror `hoverTooltip` method
 * with a code that pulls types and documentation
 * from the TypeScript environment.
 */
export function tsHover({
  renderTooltip = defaultRenderer,
}: {
  renderTooltip?: TooltipRenderer;
} = {}) {
  return hoverTooltip(async (view, pos): Promise<Tooltip | null> => {
    const config = view.state.facet(tsFacet);
    if (!config) return null;

    const hoverData = getHover({
      ...config,
      pos,
    });

    if (!hoverData) return null;

    return {
      pos: hoverData.start,
      end: hoverData.end,
      create: () => renderTooltip(hoverData, view),
    };
  });
}

/**
 * This information is passed to the API consumer to allow
 * them to create tooltips however they wish.
 */
export interface HoverInfo {
  start: number;
  end: number;
  typeDef: readonly ts.DefinitionInfo[] | undefined;
  quickInfo: ts.QuickInfo | undefined;
}

export function getHover({
  env,
  path,
  pos,
}: {
  env: VirtualTypeScriptEnvironment;
  path: string;
  pos: number;
}): HoverInfo | null {
  const sourcePos = pos;
  if (sourcePos === null) return null;

  const quickInfo = env.languageService.getQuickInfoAtPosition(path, sourcePos);
  if (!quickInfo) return null;

  const start = quickInfo.textSpan.start;

  const typeDef =
    env.languageService.getTypeDefinitionAtPosition(path, sourcePos) ??
    env.languageService.getDefinitionAtPosition(path, sourcePos);

  return {
    start,
    end: start + quickInfo.textSpan.length,
    typeDef,
    quickInfo,
  };
}

export type TooltipRenderer = (
  arg0: HoverInfo,
  editorView: EditorView,
) => TooltipView;

/**
 * Default, barebones tooltip renderer. Generates
 * structure of a div, containing a series of
 * span elements with the typescript `kind` as
 * classes.
 */
export const defaultRenderer: TooltipRenderer = (info: HoverInfo) => {
  const div = document.createElement("div");
  if (info.quickInfo?.displayParts) {
    for (let part of info.quickInfo.displayParts) {
      const span = div.appendChild(document.createElement("span"));
      span.className = `quick-info-${part.kind}`;
      span.innerText = part.text;
    }
  }
  return { dom: div };
};
