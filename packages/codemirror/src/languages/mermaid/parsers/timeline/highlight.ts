import { styleTags } from '@lezer/highlight';
import { timelineTags } from '../../tags';

export const timelineHighlighting = styleTags({
  DiagramName: timelineTags.diagramName,
  Keyword: timelineTags.keyword,
  Text: timelineTags.text,
  Period: timelineTags.period,
  Event: timelineTags.text,
  LineComment: timelineTags.lineComment,
});
