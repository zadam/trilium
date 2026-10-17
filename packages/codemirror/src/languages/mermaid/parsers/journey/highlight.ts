import { styleTags } from '@lezer/highlight';
import { journeyTags } from '../../tags';

export const journeyHighlighting = styleTags({
  DiagramName: journeyTags.diagramName,
  'Text TaskName': journeyTags.text,
  Actor: journeyTags.actor,
  Keyword: journeyTags.keyword,
  LineComment: journeyTags.lineComment,
  Score: journeyTags.score,
});
