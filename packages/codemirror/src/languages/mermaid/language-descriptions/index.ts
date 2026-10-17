import { LanguageDescription } from '@codemirror/language';
import {
  mermaid,
  mindmap,
  pie,
  flowchart,
  sequence,
  journey,
  requirement,
  gantt,
  timeline,
  quadrant,
  sankey,
  xychart,
  packet,
  kanban,
  block,
  architecture,
  classDiagram,
  state,
  er,
  git,
  c4,
} from '../language-support';
import { MermaidDescriptionName, MermaidAlias } from '../types';

export const mermaidLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Mermaid,
  load: async () => {
    return mermaid();
  },
});

export const mindmapLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Mindmap,
  load: async () => {
    return mindmap();
  },
});

export const pieLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Pie,
  load: async () => {
    return pie();
  },
});

export const flowchartLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Flowchart,
  alias: [MermaidAlias.Graph],
  load: async () => {
    return flowchart();
  },
});

export const sequenceLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Sequence,
  alias: [MermaidAlias.Sequence],
  load: async () => {
    return sequence();
  },
});

export const journeyLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Journey,
  load: async () => {
    return journey();
  },
});

export const requirementLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Requirement,
  alias: [MermaidAlias.Requirement],
  load: async () => {
    return requirement();
  },
});

export const ganttLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Gantt,
  load: async () => {
    return gantt();
  },
});

export const timelineLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Timeline,
  load: async () => {
    return timeline();
  },
});

export const quadrantLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Quadrant,
  load: async () => {
    return quadrant();
  },
});

export const sankeyLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Sankey,
  load: async () => {
    return sankey();
  },
});

export const xychartLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Xychart,
  load: async () => {
    return xychart();
  },
});

export const packetLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Packet,
  load: async () => {
    return packet();
  },
});

export const kanbanLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Kanban,
  load: async () => {
    return kanban();
  },
});

export const blockLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Block,
  load: async () => {
    return block();
  },
});

export const architectureLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Architecture,
  load: async () => {
    return architecture();
  },
});

export const classLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Class,
  load: async () => {
    return classDiagram();
  },
});

export const stateLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.State,
  load: async () => {
    return state();
  },
});

export const erLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Er,
  load: async () => {
    return er();
  },
});

export const gitLanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.Git,
  load: async () => {
    return git();
  },
});

export const c4LanguageDescription = LanguageDescription.of({
  name: MermaidDescriptionName.C4,
  load: async () => {
    return c4();
  },
});
