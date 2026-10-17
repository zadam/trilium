import { ExternalTokenizer } from '@lezer/lr';
import { NodeText, NodeEdgeText, StyleText } from  './flowchart.grammar.terms';

const skipCodePoints = [-1, 9, 13, 32, 34, 39, 96];
const startBracketCodePoints = [40, 62, 91, 123, 124];
const endBracketCodePoints = [41, 93, 124, 125];
const hyphen = 45;
const equal = 61;
const dot = 46;

export const nodeText = new ExternalTokenizer((input) => {
  if (
    skipCodePoints.includes(input.next) ||
    startBracketCodePoints.includes(input.next)
  )
    return;

  while (!endBracketCodePoints.includes(input.next) && input.next !== -1) {
    input.advance();
  }

  input.acceptToken(NodeText);
});

export const nodeEdgeText = new ExternalTokenizer((input) => {
  if (
    skipCodePoints.includes(input.next) ||
    startBracketCodePoints.includes(input.next) ||
    input.next === hyphen ||
    input.next === equal ||
    input.next === dot
  )
    return;

  while (
    input.next !== hyphen &&
    input.next !== equal &&
    input.next !== dot &&
    input.next !== -1
  ) {
    input.advance();
  }

  input.acceptToken(NodeEdgeText);
});

export const styleText = new ExternalTokenizer((input) => {
  if (input.next === 10 || input.next === -1) return;

  while (input.next !== 10 && input.next !== -1) {
    input.advance();
  }

  input.acceptToken(StyleText);
});
