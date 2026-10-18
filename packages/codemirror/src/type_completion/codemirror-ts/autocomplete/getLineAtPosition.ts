/**
 * TODO: confirm that this is necessary; it may be possible
 * and more efficient to get the line from CodeMirror, though
 * that would mean it probably doesn't mix well with the approach
 * of persisting code in the TS enviroment.
 */
export function getLineAtPosition(code: string, position: number) {
  // lineStart is the index of line break or zero
  const from = code.lastIndexOf("\n", position - 1) + 1;
  let to = code.indexOf("\n", position);
  if (to === -1) {
    to = code.length;
  }
  const text = code.slice(from, to);
  return {
    from,
    to,
    text,
  };
}
