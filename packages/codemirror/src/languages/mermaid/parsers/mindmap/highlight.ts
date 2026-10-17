import { styleTags } from '@lezer/highlight';
import { mindmapTags } from '../../tags';

export const mindmapHighlighting = styleTags({
  DiagramName: mindmapTags.diagramName,
  LineText1: mindmapTags.lineText1,
  LineText2: mindmapTags.lineText2,
  LineText3: mindmapTags.lineText3,
  LineText4: mindmapTags.lineText4,
  LineText5: mindmapTags.lineText5,
});
