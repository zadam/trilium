import { styleTags } from "@lezer/highlight";
import { mindmapTags } from "../../tags/index.js";

export const mindmapHighlighting = styleTags({
    DiagramName: mindmapTags.diagramName,
    Directive: mindmapTags.directive,
    LineComment: mindmapTags.lineComment,
    LineText1: mindmapTags.lineText1,
    LineText2: mindmapTags.lineText2,
    LineText3: mindmapTags.lineText3,
    LineText4: mindmapTags.lineText4,
    LineText5: mindmapTags.lineText5
});
