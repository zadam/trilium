import { describe, expect, it } from "vitest";

import { diagnoseTemplate, type TemplateLintMessages, tokenizeTemplate } from "./trilium_template.js";

const MESSAGES: TemplateLintMessages = {
    unclosed: "unclosed",
    unsupported: "unsupported",
    unknownVariable: (name) => `variable:${name}`,
    propertyNotAllowed: (name) => `property:${name}`,
    methodNotAllowed: (name) => `method:${name}`
};

function tokensOf(text: string) {
    return tokenizeTemplate(text).map(({ from, to, kind }) => `${kind}:${text.slice(from, to)}`);
}

describe("tokenizeTemplate", () => {
    it("colours the expressions and leaves the literal text alone", () => {
        expect(tokensOf("NEW: ${note.title}")).toStrictEqual([
            "delimiter:${", "variable:note", "property:.title", "delimiter:}"
        ]);
    });

    it("tells a method call and its string argument from a property", () => {
        expect(tokensOf("${note.dateCreatedObj.format('MM-DD')}")).toStrictEqual([
            "delimiter:${", "variable:note", "property:.dateCreatedObj", "method:.format",
            "punctuation:(", "string:'MM-DD'", "punctuation:)", "delimiter:}"
        ]);
    });

    it("colours an expression still being typed, up to the end of the text", () => {
        expect(tokensOf("A ${note.")).toStrictEqual([ "delimiter:${", "variable:note", "property:." ]);
    });
});

describe("diagnoseTemplate", () => {
    it("underlines each refused expression with the consumer's wording", () => {
        const diagnostics = diagnoseTemplate("${note.title} ${note.constructor} ${other} ${note.title", [ "note" ], MESSAGES);

        expect(diagnostics.map((d) => d.message)).toStrictEqual([
            "property:constructor", "variable:other", "unclosed"
        ]);
        expect(diagnostics.every((d) => d.severity === "error")).toBe(true);
        expect([ diagnostics[0].from, diagnostics[0].to ]).toStrictEqual([ 14, 33 ]);
    });

    it("has nothing to say about a valid template", () => {
        expect(diagnoseTemplate("NEW: ${note.title}", [ "note" ], MESSAGES)).toStrictEqual([]);
    });
});
