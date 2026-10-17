import { LanguageSupport } from '@codemirror/language';
import {
  mermaidLanguage,
  mindmapLanguage,
  pieLanguage,
  flowchartLanguage,
  sequenceLanguage,
  journeyLanguage,
  requirementLanguage,
  ganttLanguage,
  timelineLanguage,
  quadrantLanguage,
  sankeyLanguage,
  xychartLanguage,
  packetLanguage,
  kanbanLanguage,
  blockLanguage,
  architectureLanguage,
  classLanguage,
  stateLanguage,
  erLanguage,
  gitLanguage,
  c4Language,
} from '../language-definitions';

export function mermaid() {
  return new LanguageSupport(mermaidLanguage);
}

export function mindmap() {
  return new LanguageSupport(mindmapLanguage);
}

export function pie() {
  return new LanguageSupport(pieLanguage);
}

export function flowchart() {
  return new LanguageSupport(flowchartLanguage);
}

export function sequence() {
  return new LanguageSupport(sequenceLanguage);
}

export function journey() {
  return new LanguageSupport(journeyLanguage);
}

export function requirement() {
  return new LanguageSupport(requirementLanguage);
}

export function gantt() {
  return new LanguageSupport(ganttLanguage);
}

export function timeline() {
  return new LanguageSupport(timelineLanguage);
}

export function quadrant() {
  return new LanguageSupport(quadrantLanguage);
}

export function sankey() {
  return new LanguageSupport(sankeyLanguage);
}

export function xychart() {
  return new LanguageSupport(xychartLanguage);
}

export function packet() {
  return new LanguageSupport(packetLanguage);
}

export function kanban() {
  return new LanguageSupport(kanbanLanguage);
}

export function block() {
  return new LanguageSupport(blockLanguage);
}

export function architecture() {
  return new LanguageSupport(architectureLanguage);
}

export function classDiagram() {
  return new LanguageSupport(classLanguage);
}

export function state() {
  return new LanguageSupport(stateLanguage);
}

export function er() {
  return new LanguageSupport(erLanguage);
}

export function git() {
  return new LanguageSupport(gitLanguage);
}

export function c4() {
  return new LanguageSupport(c4Language);
}
