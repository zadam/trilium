import { styleTags } from '@lezer/highlight';
import { requirementTags } from '../../tags';

export const requirementHighlighting = styleTags({
  'DiagramName SubDiagramType': requirementTags.diagramName,
  LineComment: requirementTags.lineComment,
  IDNumber: requirementTags.number,
  'UnquotedString RelationshipStart': requirementTags.unquotedString,
  QuotedString: requirementTags.quotedString,
  PropKeyword: requirementTags.unquotedString,
  Keyword: requirementTags.keyword,
  'ForwardArrow BackArrow Hyphen': requirementTags.arrow,
});
