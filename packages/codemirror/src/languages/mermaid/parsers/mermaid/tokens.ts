import { ExternalTokenizer } from '@lezer/lr';
import {
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
} from './mermaid.grammar.terms';

const skipCodePoints = [-1, 9, 13, 32];

// Order matters: more specific keys are listed before the generic prefixes they
// share (e.g. `sankey-beta` before `sankey`). Every key that is a prefix of
// another still maps to the same diagram, so ties resolve to the correct type.
const diagramMap: Record<string, number> = {
  mindmap: MindmapDiagram,
  pie: PieDiagram,
  flowchart: FlowchartDiagram,
  graph: FlowchartDiagram,
  sequenceDiagram: SequenceDiagram,
  journey: JourneyDiagram,
  requirementDiagram: RequirementDiagram,
  gantt: GanttDiagram,
  timeline: TimelineDiagram,
  quadrantChart: QuadrantDiagram,
  'sankey-beta': SankeyDiagram,
  sankey: SankeyDiagram,
  'xychart-beta': XYChartDiagram,
  xychart: XYChartDiagram,
  'packet-beta': PacketDiagram,
  packet: PacketDiagram,
  kanban: KanbanDiagram,
  'block-beta': BlockDiagram,
  block: BlockDiagram,
  'architecture-beta': ArchitectureDiagram,
  architecture: ArchitectureDiagram,
  'classDiagram-v2': ClassDiagram,
  classDiagram: ClassDiagram,
  'stateDiagram-v2': StateDiagram,
  stateDiagram: StateDiagram,
  erDiagram: ERDiagram,
  gitGraph: GitDiagram,
  C4Context: C4Diagram,
  C4Container: C4Diagram,
  C4Component: C4Diagram,
  C4Dynamic: C4Diagram,
  C4Deployment: C4Diagram,
};

const diagrams = Object.keys(diagramMap);

export const diagramText = new ExternalTokenizer((input) => {
  if (skipCodePoints.includes(input.next)) return;

  let tokens = '';

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
