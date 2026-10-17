import { ExternalTokenizer } from '@lezer/lr';
import {
  columnTitleTerm,
  nodeIdTerm,
  cardTextTerm,
  metadataTerm,
} from './kanban.grammar.terms';

const newline = 10,
  space = 32,
  tab = 9,
  cr = 13,
  percent = 37,
  bracketL = 91,
  at = 64,
  braceL = 123,
  braceR = 125,
  underscore = 95;

const isWordChar = (c: number) =>
  (c >= 48 && c <= 57) ||
  (c >= 65 && c <= 90) ||
  (c >= 97 && c <= 122) ||
  c === underscore;

// A bare column title: a line that contains no "[" card bracket.
export const columnTitleTokens = new ExternalTokenizer((input) => {
  if (
    input.next === space ||
    input.next === tab ||
    input.next === cr ||
    input.next === newline ||
    input.next === -1 ||
    input.next === bracketL
  ) {
    return;
  }

  let length = 0;

  while (input.next !== newline && input.next !== -1) {
    if (input.next === bracketL) return; // it is a card line — let NodeId/"[" handle it
    if (input.next === percent && input.peek(1) === percent) break; // stop before %%
    input.advance();
    length++;
  }

  if (length > 0) {
    input.acceptToken(columnTitleTerm);
  }
});

// A card id that is immediately followed by "[", e.g. docs[...] or id6[...].
export const nodeIdTokens = new ExternalTokenizer((input) => {
  if (!isWordChar(input.next)) return;

  let length = 0;

  while (isWordChar(input.next)) {
    input.advance();
    length++;
  }

  if (length > 0 && (input.next as number) === bracketL) {
    input.acceptToken(nodeIdTerm);
  }
});

// The text inside a card's [ ... ] brackets.
export const cardTextTokens = new ExternalTokenizer((input) => {
  if (input.next === 93 || input.next === newline || input.next === -1) {
    return;
  }

  while (input.next !== 93 && input.next !== newline && input.next !== -1) {
    input.advance();
  }

  input.acceptToken(cardTextTerm);
});

// Optional trailing card metadata: @{ ... }
export const metadataTokens = new ExternalTokenizer((input) => {
  if (input.next !== at || input.peek(1) !== braceL) return;

  input.advance(); // @
  input.advance(); // {

  while ((input.next as number) !== braceR && (input.next as number) !== -1) {
    input.advance();
  }

  if ((input.next as number) === braceR) {
    input.advance();
  }

  input.acceptToken(metadataTerm);
});
