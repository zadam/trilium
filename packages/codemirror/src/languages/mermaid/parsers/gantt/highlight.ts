import { styleTags } from '@lezer/highlight';
import { ganttTags } from '../../tags';

export const ganttHighlighting = styleTags({
  'DiagramName Section': ganttTags.diagramName,
  Keyword: ganttTags.keyword,
  ImportantText: ganttTags.string,
  LineComment: ganttTags.lineComment,
});
