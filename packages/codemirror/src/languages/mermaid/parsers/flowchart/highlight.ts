import { styleTags, tags as t } from '@lezer/highlight';
import { flowchartTags } from '../../tags';

export const flowchartHighlighting = styleTags({
  '( )': t.paren,
  '[ ]': t.squareBracket,
  '{ }': t.brace,
  '<': t.angleBracket,
  DiagramName: flowchartTags.diagramName,
  DoubleEqual: flowchartTags.link,
  DoubleHyphen: flowchartTags.link,
  Keyword: flowchartTags.keyword,
  LineComment: flowchartTags.lineComment,
  Link: flowchartTags.link,
  NodeEdge: flowchartTags.nodeEdge,
  NodeEdgeText: flowchartTags.nodeEdgeText,
  NodeId: flowchartTags.nodeId,
  NodeText: flowchartTags.nodeText,
  Number: flowchartTags.number,
  Orientation: flowchartTags.orientation,
  String: flowchartTags.string,
});
