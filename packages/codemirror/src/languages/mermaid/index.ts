// Mermaid language support, vendored from https://github.com/Edge-Tools/codemirror-lang-mermaid
// (itself a fork of https://github.com/inspirnathan/codemirror-lang-mermaid); MIT, see LICENSE.
// After editing a `.grammar` file, regenerate its parser with
// `pnpm --filter @triliumnext/codemirror build:mermaid-grammars`.
import { yamlLanguage } from "@codemirror/lang-yaml";
import { languageDataProp, LanguageSupport, LRLanguage } from "@codemirror/language";
import { parseMixed, type SyntaxNode } from "@lezer/common";
import type { LRParser } from "@lezer/lr";

import { parser as architectureParser } from "./parsers/architecture/parser.js";
import { parser as blockParser } from "./parsers/block/parser.js";
import { parser as c4Parser } from "./parsers/c4/parser.js";
import { parser as classParser } from "./parsers/class/parser.js";
import { parser as erParser } from "./parsers/er/parser.js";
import { parser as flowchartParser } from "./parsers/flowchart/parser.js";
import { parser as ganttParser } from "./parsers/gantt/parser.js";
import { parser as gitParser } from "./parsers/git/parser.js";
import { parser as journeyParser } from "./parsers/journey/parser.js";
import { parser as kanbanParser } from "./parsers/kanban/parser.js";
import { parser as mermaidParser } from "./parsers/mermaid/parser.js";
import { parser as mindmapParser } from "./parsers/mindmap/parser.js";
import { parser as packetParser } from "./parsers/packet/parser.js";
import { parser as pieParser } from "./parsers/pie/parser.js";
import { parser as quadrantParser } from "./parsers/quadrant/parser.js";
import { parser as requirementParser } from "./parsers/requirement/parser.js";
import { parser as sankeyParser } from "./parsers/sankey/parser.js";
import { parser as sequenceParser } from "./parsers/sequence/parser.js";
import { parser as stateParser } from "./parsers/state/parser.js";
import { parser as timelineParser } from "./parsers/timeline/parser.js";
import { parser as xychartParser } from "./parsers/xychart/parser.js";

export { foldByIndent } from "./extensions/index.js";

/**
 * The parser of each diagram, keyed by the node `mermaid.grammar` emits for it. The top-level
 * grammar only detects the diagram type; `parseMixed()` hands the rest of the document to the
 * parser of that type.
 */
export const DIAGRAM_PARSERS: Record<string, LRParser> = {
    ArchitectureDiagram: architectureParser,
    BlockDiagram: blockParser,
    C4Diagram: c4Parser,
    ClassDiagram: classParser,
    ERDiagram: erParser,
    FlowchartDiagram: flowchartParser,
    GanttDiagram: ganttParser,
    GitDiagram: gitParser,
    JourneyDiagram: journeyParser,
    KanbanDiagram: kanbanParser,
    MindmapDiagram: mindmapParser,
    PacketDiagram: packetParser,
    PieDiagram: pieParser,
    QuadrantDiagram: quadrantParser,
    RequirementDiagram: requirementParser,
    SankeyDiagram: sankeyParser,
    SequenceDiagram: sequenceParser,
    StateDiagram: stateParser,
    TimelineDiagram: timelineParser,
    XYChartDiagram: xychartParser
};

export const mermaidLanguage = LRLanguage.define({
    name: "mermaid",
    parser: mermaidParser.configure({
        wrap: parseMixed((node) => {
            if (node.name === "FrontMatterContent") return { parser: yamlLanguage.parser };
            const parser = nestedParsers[node.name];
            if (!parser) return null;
            const overlay = textAroundAccessibility(node.node);
            return overlay ? { parser, overlay } : { parser };
        })
    }),
    languageData: {
        commentTokens: { line: "%%" }
    }
});

// CodeMirror reads language data from the innermost top node at a position, which is the
// diagram's own top node, so each diagram parser carries the data of `mermaidLanguage` too.
const nestedParsers = Object.fromEntries(Object.entries(DIAGRAM_PARSERS).map(([ name, parser ]) => [
    name,
    parser.configure({
        props: [ languageDataProp.add((type) => type.isTop ? mermaidLanguage.data : undefined) ]
    })
]));

export function mermaid() {
    return new LanguageSupport(mermaidLanguage);
}

/**
 * The ranges of a diagram outside its `AccTitle` and `AccDescr` nodes, for the diagram's parser to
 * cover; `null` when it has none. Those nodes are the only named children of a diagram, and
 * diagram text always comes before each one.
 */
function textAroundAccessibility(diagram: SyntaxNode) {
    const ranges: { from: number; to: number }[] = [];
    let from = diagram.from;
    for (let child = diagram.firstChild; child; child = child.nextSibling) {
        ranges.push({ from, to: child.from });
        from = child.to;
    }
    if (from === diagram.from) return null;
    if (diagram.to > from) ranges.push({ from, to: diagram.to });
    return ranges;
}
