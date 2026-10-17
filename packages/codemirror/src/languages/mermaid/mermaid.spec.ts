import { readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

import { LanguageSupport } from "@codemirror/language";
import type { Parser } from "@lezer/common";
import { fileTests } from "@lezer/generator/test";
import { describe, expect, it } from "vitest";

import { buildGrammar, listGrammars } from "../../../scripts/build_mermaid_grammars.mjs";
import { DIAGRAM_PARSERS, mermaid, mermaidLanguage } from "./index.js";

const grammars = listGrammars();
const diagrams = grammars.map((grammarPath) => basename(dirname(grammarPath)));
const parsers = import.meta.glob<Parser>("./parsers/*/parser.ts", {
    eager: true,
    import: "parser"
});
const parserOf = (diagram: string) => diagram === "mermaid"
    ? mermaidLanguage.parser
    : parsers[`./parsers/${diagram}/parser.ts`];

describe("Mermaid grammars", () => {
    it("has a committed parser that matches each grammar", () => {
        expect(grammars.length).toBeGreaterThan(0);
        for (const grammarPath of grammars) {
            for (const [ path, content ] of Object.entries(buildGrammar(grammarPath))) {
                // Run `pnpm --filter @triliumnext/codemirror build:mermaid-grammars` to regenerate.
                expect(readFileSync(path, "utf8"), path).toBe(content);
            }
        }
    });

    it("wires the parser of every diagram into the top-level language", () => {
        const wired = new Set(Object.values(DIAGRAM_PARSERS));
        for (const diagram of diagrams.filter((name) => name !== "mermaid")) {
            expect(wired.has(parserOf(diagram)), diagram).toBe(true);
        }
        expect(wired.size).toBe(diagrams.length - 1);
    });
});

describe.each(diagrams)("%s grammar", (diagram) => {
    const parser = parserOf(diagram);
    const fileName = `${diagram}.txt`;
    const file = readFileSync(join(import.meta.dirname, "test", fileName), "utf8");

    for (const { name, run } of fileTests(file, fileName)) {
        it(name, () => run(parser));
    }
});

describe("mermaid", () => {
    it("detects the diagram type and parses the rest with that diagram's grammar", () => {
        const support = mermaid();
        expect(support).toBeInstanceOf(LanguageSupport);
        expect(support.language).toBe(mermaidLanguage);

        const tree = mermaidLanguage.parser.parse("---\ntitle: x\n---\npie\n  \"A\": 1\n");
        expect(tree.toString()).toBe("MermaidDiagram(PieDiagram(DiagramName,String,Number))");
        expect(mermaidLanguage.parser.parse("not a diagram\n").toString())
            .toBe("MermaidDiagram(⚠)");
    });
});
