import { LRLanguage } from '@codemirror/language';
import { parseMixed } from '@lezer/common';
import {
  mermaidParser,
  mindmapParser,
  pieParser,
  flowchartParser,
  sequenceParser,
  journeyParser,
  requirementParser,
  ganttParser,
  timelineParser,
  quadrantParser,
  sankeyParser,
  xychartParser,
  packetParser,
  kanbanParser,
  blockParser,
  architectureParser,
  classParser,
  stateParser,
  erParser,
  gitParser,
  c4Parser,
} from '../parsers';
import { DiagramType, MermaidLanguageType } from '../types';

export const mermaidLanguage = LRLanguage.define({
  name: MermaidLanguageType.Mermaid,
  parser: mermaidParser.configure({
    wrap: parseMixed((node) => {
      switch (node.name) {
        case DiagramType.Mindmap:
          return { parser: mindmapParser };
        case DiagramType.Pie:
          return { parser: pieParser };
        case DiagramType.Flowchart:
          return { parser: flowchartParser };
        case DiagramType.Sequence:
          return { parser: sequenceParser };
        case DiagramType.Journey:
          return { parser: journeyParser };
        case DiagramType.Requirement:
          return { parser: requirementParser };
        case DiagramType.Gantt:
          return { parser: ganttParser };
        case DiagramType.Timeline:
          return { parser: timelineParser };
        case DiagramType.Quadrant:
          return { parser: quadrantParser };
        case DiagramType.Sankey:
          return { parser: sankeyParser };
        case DiagramType.Xychart:
          return { parser: xychartParser };
        case DiagramType.Packet:
          return { parser: packetParser };
        case DiagramType.Kanban:
          return { parser: kanbanParser };
        case DiagramType.Block:
          return { parser: blockParser };
        case DiagramType.Architecture:
          return { parser: architectureParser };
        case DiagramType.Class:
          return { parser: classParser };
        case DiagramType.State:
          return { parser: stateParser };
        case DiagramType.Er:
          return { parser: erParser };
        case DiagramType.Git:
          return { parser: gitParser };
        case DiagramType.C4:
          return { parser: c4Parser };
        default:
          return null;
      }
    }),
  }),
});

export const mindmapLanguage = LRLanguage.define({
  name: MermaidLanguageType.Mindmap,
  parser: mindmapParser,
});

export const pieLanguage = LRLanguage.define({
  name: MermaidLanguageType.Pie,
  parser: pieParser,
});

export const flowchartLanguage = LRLanguage.define({
  name: MermaidLanguageType.Flowchart,
  parser: flowchartParser,
});

export const sequenceLanguage = LRLanguage.define({
  name: MermaidLanguageType.Sequence,
  parser: sequenceParser,
});

export const journeyLanguage = LRLanguage.define({
  name: MermaidLanguageType.Journey,
  parser: journeyParser,
});

export const requirementLanguage = LRLanguage.define({
  name: MermaidLanguageType.Requirement,
  parser: requirementParser,
});

export const ganttLanguage = LRLanguage.define({
  name: MermaidLanguageType.Gantt,
  parser: ganttParser,
});

export const timelineLanguage = LRLanguage.define({
  name: MermaidLanguageType.Timeline,
  parser: timelineParser,
});

export const quadrantLanguage = LRLanguage.define({
  name: MermaidLanguageType.Quadrant,
  parser: quadrantParser,
});

export const sankeyLanguage = LRLanguage.define({
  name: MermaidLanguageType.Sankey,
  parser: sankeyParser,
});

export const xychartLanguage = LRLanguage.define({
  name: MermaidLanguageType.Xychart,
  parser: xychartParser,
});

export const packetLanguage = LRLanguage.define({
  name: MermaidLanguageType.Packet,
  parser: packetParser,
});

export const kanbanLanguage = LRLanguage.define({
  name: MermaidLanguageType.Kanban,
  parser: kanbanParser,
});

export const blockLanguage = LRLanguage.define({
  name: MermaidLanguageType.Block,
  parser: blockParser,
});

export const architectureLanguage = LRLanguage.define({
  name: MermaidLanguageType.Architecture,
  parser: architectureParser,
});

export const classLanguage = LRLanguage.define({
  name: MermaidLanguageType.Class,
  parser: classParser,
});

export const stateLanguage = LRLanguage.define({
  name: MermaidLanguageType.State,
  parser: stateParser,
});

export const erLanguage = LRLanguage.define({
  name: MermaidLanguageType.Er,
  parser: erParser,
});

export const gitLanguage = LRLanguage.define({
  name: MermaidLanguageType.Git,
  parser: gitParser,
});

export const c4Language = LRLanguage.define({
  name: MermaidLanguageType.C4,
  parser: c4Parser,
});
