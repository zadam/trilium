import { hoverTooltip, Tooltip } from "@codemirror/view";
import { getHover } from "./getHover.js";
import { defaultRenderer, TooltipRenderer } from "./renderTooltip.js";
import { tsFacet } from "../facet/tsFacet.js";

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
