import { styleTags } from "@lezer/highlight";

import { mermaidTags } from "../../tags/index.js";

export const mermaidHighlighting = styleTags({
    DashLine: mermaidTags.frontMatterDelimiter,
    Directive: mermaidTags.directive,
    LineComment: mermaidTags.lineComment
});
