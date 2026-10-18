/**
 * There is some overlap between CodeMirror's
 * types and TypeScripts. This is all of the default
 * icons for CodeMirror: if TypeScript gives us one
 * of these, we pass it through.
 */
export const DEFAULT_CODEMIRROR_TYPE_ICONS = new Set([
  `class`,
  `constant`,
  `enum`,
  `function`,
  `interface`,
  `keyword`,
  `method`,
  `namespace`,
  `property`,
  `text`,
  `type`,
  `variable`,
]);
