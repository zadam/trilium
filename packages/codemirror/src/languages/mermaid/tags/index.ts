import { Tag, tags as t } from '@lezer/highlight';

export const mermaidTags = {
  diagramName: Tag.define(t.typeName),
};

export const mindmapTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  lineText1: Tag.define(),
  lineText2: Tag.define(),
  lineText3: Tag.define(),
  lineText4: Tag.define(),
  lineText5: Tag.define(),
};

export const pieTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  lineComment: Tag.define(t.lineComment),
  number: Tag.define(t.number),
  showData: Tag.define(t.keyword),
  string: Tag.define(t.string),
  title: Tag.define(t.keyword),
  titleText: Tag.define(t.string),
};

export const flowchartTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  lineComment: Tag.define(t.lineComment),
  link: Tag.define(t.contentSeparator),
  nodeEdge: Tag.define(t.contentSeparator),
  nodeEdgeText: Tag.define(t.string),
  nodeId: Tag.define(t.variableName),
  nodeText: Tag.define(t.string),
  number: Tag.define(t.number),
  orientation: Tag.define(t.modifier),
  string: Tag.define(t.string),
};

export const sequenceTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  arrow: Tag.define(t.contentSeparator),
  keyword1: Tag.define(t.keyword),
  keyword2: Tag.define(t.controlKeyword),
  lineComment: Tag.define(t.lineComment),
  messageText1: Tag.define(t.string),
  messageText2: Tag.define(t.content),
  nodeText: Tag.define(t.variableName),
  position: Tag.define(t.modifier),
};

export const journeyTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  actor: Tag.define(t.variableName),
  keyword: Tag.define(t.keyword),
  lineComment: Tag.define(t.lineComment),
  score: Tag.define(t.number),
  text: Tag.define(t.string),
};

export const requirementTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  arrow: Tag.define(t.contentSeparator),
  keyword: Tag.define(t.keyword),
  lineComment: Tag.define(t.lineComment),
  number: Tag.define(t.number),
  quotedString: Tag.define(t.string),
  unquotedString: Tag.define(t.content),
};

export const ganttTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  lineComment: Tag.define(t.lineComment),
  string: Tag.define(t.string),
};

export const timelineTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  lineComment: Tag.define(t.lineComment),
  period: Tag.define(t.variableName),
  text: Tag.define(t.string),
};

export const quadrantTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  label: Tag.define(t.variableName),
  lineComment: Tag.define(t.lineComment),
  number: Tag.define(t.number),
  text: Tag.define(t.string),
};

export const sankeyTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  node: Tag.define(t.variableName),
  number: Tag.define(t.number),
};

export const xychartTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  orientation: Tag.define(t.modifier),
  string: Tag.define(t.string),
  number: Tag.define(t.number),
  text: Tag.define(t.variableName),
  arrow: Tag.define(t.contentSeparator),
  lineComment: Tag.define(t.lineComment),
};

export const packetTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  number: Tag.define(t.number),
  string: Tag.define(t.string),
  titleText: Tag.define(t.string),
  lineComment: Tag.define(t.lineComment),
};

export const kanbanTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  columnTitle: Tag.define(t.keyword),
  nodeId: Tag.define(t.variableName),
  cardText: Tag.define(t.string),
  metadata: Tag.define(t.meta),
  lineComment: Tag.define(t.lineComment),
};

export const blockTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  lineComment: Tag.define(t.lineComment),
  nodeId: Tag.define(t.variableName),
  nodeText: Tag.define(t.string),
  arrow: Tag.define(t.contentSeparator),
  arrowText: Tag.define(t.string),
  number: Tag.define(t.number),
};

export const architectureTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  lineComment: Tag.define(t.lineComment),
  nodeId: Tag.define(t.variableName),
  icon: Tag.define(t.attributeName),
  label: Tag.define(t.string),
  port: Tag.define(t.modifier),
  arrow: Tag.define(t.contentSeparator),
};

export const classTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  className: Tag.define(t.variableName),
  arrow: Tag.define(t.contentSeparator),
  member: Tag.define(t.content),
  string: Tag.define(t.string),
  annotation: Tag.define(t.modifier),
  lineComment: Tag.define(t.lineComment),
};

export const stateTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  stateName: Tag.define(t.variableName),
  startEnd: Tag.define(t.controlKeyword),
  arrow: Tag.define(t.contentSeparator),
  label: Tag.define(t.string),
  string: Tag.define(t.string),
  annotation: Tag.define(t.modifier),
  lineComment: Tag.define(t.lineComment),
};

export const erTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  entity: Tag.define(t.variableName),
  attributeType: Tag.define(t.typeName),
  attributeName: Tag.define(t.propertyName),
  keyType: Tag.define(t.modifier),
  relationship: Tag.define(t.contentSeparator),
  label: Tag.define(t.string),
  string: Tag.define(t.string),
  lineComment: Tag.define(t.lineComment),
};

export const gitTags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  direction: Tag.define(t.modifier),
  branchName: Tag.define(t.variableName),
  optionKey: Tag.define(t.propertyName),
  string: Tag.define(t.string),
  number: Tag.define(t.number),
  value: Tag.define(t.atom),
  lineComment: Tag.define(t.lineComment),
};

export const c4Tags = {
  diagramName: Tag.define(mermaidTags.diagramName),
  keyword: Tag.define(t.keyword),
  titleText: Tag.define(t.string),
  functionName: Tag.define(t.typeName),
  identifier: Tag.define(t.variableName),
  key: Tag.define(t.propertyName),
  string: Tag.define(t.string),
  lineComment: Tag.define(t.lineComment),
};
