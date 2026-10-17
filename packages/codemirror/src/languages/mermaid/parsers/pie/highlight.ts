import { styleTags } from '@lezer/highlight';
import { pieTags } from '../../tags';

export const pieHighlighting = styleTags({
  DiagramName: pieTags.diagramName,
  LineComment: pieTags.lineComment,
  Number: pieTags.number,
  ShowData: pieTags.showData,
  String: pieTags.string,
  Title: pieTags.title,
  TitleText: pieTags.titleText,
});
