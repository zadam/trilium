import { ExternalTokenizer, ContextTracker } from "@lezer/lr";

import { findDirectiveLength, lineLength } from "../mermaid/tokens.js";
import {
    Directive,
    LineComment,
    newline as newlineToken,
    newlineEmpty,
    indent,
    LineText1,
    LineText2,
    LineText3,
    LineText4,
    LineText5
} from "./parser.terms.js";

import type { InputStream } from "@lezer/lr";

type InputStreamWithRead = InputStream & {
    read: (inputPosition: number, stackPosition: number) => string;
};

const LineTextTokens = [ LineText1, LineText2, LineText3, LineText4, LineText5 ];

const newline = 10,
    carriageReturn = 13,
    space = 32,
    tab = 9,
    hash = 35,
    percent = 37,
    colon = 58,
    parenL = 40,
    parenR = 41,
    bracketL = 91,
    bracketR = 93,
    braceL = 123,
    braceR = 125;

export const newlines = new ExternalTokenizer(
    (input, _stack) => {
        if (input.next < 0) return;
        else {
            input.advance();
            let spaces = 0;
            while ((input.next as number) == space || (input.next as number) == tab) {
                input.advance();
                spaces++;
            }
            let empty =
                input.next == newline ||
                input.next == carriageReturn ||
                input.next == hash ||
                startsComment(input);
            input.acceptToken(empty ? newlineEmpty : newlineToken, -spaces);
        }
    },
    { contextual: true, fallback: true }
);

export const lineTextType = new ExternalTokenizer((input, stack) => {
    let chars = 0;

    while (input.next > -1 && input.next !== newline) {
        if (input.next === colon) return;

        if (
            input.next === parenL ||
            input.next === bracketL ||
            input.next === braceL
        ) {
            if (chars > 0) {
                input.acceptToken(stack.context.lineType);
                return;
            } else return;
        }

        if (
            (input.next === parenR ||
                input.next === bracketR ||
                input.next === braceR) &&
            chars > 0
        ) {
            input.acceptToken(stack.context.lineType);
            return;
        }

        input.advance();
        chars++;
    }

    input.acceptToken(stack.context.lineType);
});

const tabDepth = (depth: number) => {
    return 4 - (depth % 4);
};

// The indentation that starts a line; `trackIndent` measures its depth. A line that holds
// nothing else, or starts with `#` or `%%`, gets no `indent` token.
export const indentation = new ExternalTokenizer((input) => {
    const prev = input.peek(-1);
    if (prev !== newline && prev !== carriageReturn) return;

    while (input.next === space || input.next === tab) {
        input.advance();
    }
    const blank = input.next === newline || input.next === carriageReturn || input.next === hash;
    if (!blank && !startsComment(input)) {
        input.acceptToken(indent);
    }
});

// A `%%` comment, on a line of its own or after a shape (`lineTextType` takes the `%%` in
// `root %% text` as text), or a `%%{…}%%` directive, which Mermaid applies only on a line of
// its own.
export const comments = new ExternalTokenizer((input) => {
    if (!startsComment(input)) return;

    const directive = input.peek(2) === braceL && startsLine(input);
    const directiveLength = directive ? findDirectiveLength(input) : -1;
    if (directiveLength > 0) {
        input.acceptToken(Directive, directiveLength);
    } else {
        input.acceptToken(LineComment, lineLength(input));
    }
});

function startsComment(input: InputStream) {
    return input.next === percent && input.peek(1) === percent;
}

function startsLine(input: InputStream) {
    for (let offset = -1; ; offset--) {
        const previous = input.peek(offset);
        if (previous === newline || previous === -1) return true;
        if (previous !== space && previous !== tab) return false;
    }
}

const indentTracker = {
    lineType: LineText1
};

const countIndent = (space: string) => {
    let depth = 0;
    for (let i = 0; i < space.length; i++)
        depth += space.charCodeAt(i) == tab ? tabDepth(depth) : 1;
    return depth;
};

const getLineType = (depth: number) => {
    return LineTextTokens[depth % 5];
};

export const trackIndent = new ContextTracker({
    start: indentTracker,
    shift(context, term, stack, input: InputStreamWithRead) {
        if (term === indent) {
            const depth = countIndent(input.read(input.pos, stack.pos));
            context.lineType = getLineType(depth);
        }
        return context;
    }
});
