import { ExternalTokenizer, type InputStream } from "@lezer/lr";
import {
    Directive,
    FrontMatterContent,
    frontMatterEnd,
    frontMatterStart,
    preDiagramLine,
    MindmapDiagram,
    PieDiagram,
    FlowchartDiagram,
    SequenceDiagram,
    JourneyDiagram,
    RequirementDiagram,
    GanttDiagram,
    TimelineDiagram,
    QuadrantDiagram,
    SankeyDiagram,
    XYChartDiagram,
    PacketDiagram,
    KanbanDiagram,
    BlockDiagram,
    ArchitectureDiagram,
    ClassDiagram,
    StateDiagram,
    ERDiagram,
    GitDiagram,
    C4Diagram,
    LineComment
} from "./parser.terms.js";

const skipCodePoints = [ -1, 9, 13, 32 ];

// Order matters: more specific keys are listed before the generic prefixes they
// share (e.g. `sankey-beta` before `sankey`). Every key that is a prefix of
// another still maps to the same diagram, so ties resolve to the correct type.
const diagramMap: Record<string, number> = {
    "mindmap": MindmapDiagram,
    "pie": PieDiagram,
    "flowchart": FlowchartDiagram,
    "graph": FlowchartDiagram,
    "sequenceDiagram": SequenceDiagram,
    "journey": JourneyDiagram,
    "requirementDiagram": RequirementDiagram,
    "gantt": GanttDiagram,
    "timeline": TimelineDiagram,
    "quadrantChart": QuadrantDiagram,
    "sankey-beta": SankeyDiagram,
    "sankey": SankeyDiagram,
    "xychart-beta": XYChartDiagram,
    "xychart": XYChartDiagram,
    "packet-beta": PacketDiagram,
    "packet": PacketDiagram,
    "kanban": KanbanDiagram,
    "block-beta": BlockDiagram,
    "block": BlockDiagram,
    "architecture-beta": ArchitectureDiagram,
    "architecture": ArchitectureDiagram,
    "classDiagram-v2": ClassDiagram,
    "classDiagram": ClassDiagram,
    "stateDiagram-v2": StateDiagram,
    "stateDiagram": StateDiagram,
    "erDiagram": ERDiagram,
    "gitGraph": GitDiagram,
    "C4Context": C4Diagram,
    "C4Container": C4Diagram,
    "C4Component": C4Diagram,
    "C4Dynamic": C4Diagram,
    "C4Deployment": C4Diagram
};

const diagrams = Object.keys(diagramMap);

/**
 * Splits front matter into its `---` lines and the YAML between them. Like Mermaid, it takes a
 * `---` line as the opening only at the start of the document (the only place the grammar can
 * shift `frontMatterStart`) and only when a closing `---` line follows; otherwise the lines go
 * to `diagramText`.
 */
export const frontMatter = new ExternalTokenizer((input, stack) => {
    if (stack.canShift(frontMatterStart)) {
        const opening = dashLineLength(input, 0);
        if (opening > 0 && findClosingLine(input, opening) >= 0) {
            input.acceptToken(frontMatterStart, opening);
        }
    } else {
        const closing = findClosingLine(input, 0);
        if (closing > 0) {
            input.acceptToken(FrontMatterContent, closing);
        } else {
            input.acceptToken(frontMatterEnd, dashLineLength(input, 0));
        }
    }
});

export const diagramText = new ExternalTokenizer((input) => {
    if (skipCodePoints.includes(input.next)) return;

    if (input.next === 37 && input.peek(1) === 37) {
        const directiveLength = input.peek(2) === 123 ? findDirectiveLength(input) : -1;
        if (directiveLength > 0) {
            input.acceptToken(Directive, directiveLength);
        } else {
            input.acceptToken(LineComment, lineLength(input));
        }
        return;
    }

    let tokens = "";

    while (input.next != 10 && input.next !== -1) {
        tokens += String.fromCodePoint(input.next);
        input.advance();
    }

    input.advance();

    const activeDiagram = diagrams.filter((diagram) => {
        return tokens.startsWith(diagram);
    });

    if (activeDiagram.length > 0) {
        while (input.next !== -1) {
            input.advance();
        }
        input.acceptToken(diagramMap[activeDiagram[0]]);
    } else {
        input.acceptToken(preDiagramLine);
    }
});

/**
 * The length of the `%%{…}%%` directive at the stream position, which can span lines; -1 when it
 * has no closing `}%%`.
 */
export function findDirectiveLength(input: InputStream) {
    for (let offset = 3; input.peek(offset) !== -1; offset++) {
        const closes = input.peek(offset) === 125 && input.peek(offset + 1) === 37
            && input.peek(offset + 2) === 37;
        if (closes) return offset + 3;
    }
    return -1;
}

/** The length of the rest of the line at the stream position, newline excluded. */
export function lineLength(input: InputStream) {
    let length = 0;
    while (input.peek(length) !== 10 && input.peek(length) !== -1) length++;
    return length;
}

/** The offset of the first `---` line at or after `offset`, or -1 when there is none. */
function findClosingLine(input: InputStream, offset: number) {
    while (input.peek(offset) !== -1) {
        if (dashLineLength(input, offset) > 0) return offset;
        while (input.peek(offset) !== 10 && input.peek(offset) !== -1) offset++;
        offset++;
    }
    return -1;
}

/**
 * The length of the line at `offset`, newline included, when it is `---` followed by nothing but
 * whitespace; otherwise 0.
 */
function dashLineLength(input: InputStream, offset: number) {
    let length = 0;
    while (length < 3) {
        if (input.peek(offset + length) !== 45) return 0;
        length++;
    }
    while ([ 9, 13, 32 ].includes(input.peek(offset + length))) length++;
    const next = input.peek(offset + length);
    if (next === 10) return length + 1;
    return next === -1 ? length : 0;
}
