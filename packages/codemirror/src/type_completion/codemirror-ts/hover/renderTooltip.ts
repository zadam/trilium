import { EditorView, TooltipView } from "@codemirror/view";
import { HoverInfo } from "./getHover.js";

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
