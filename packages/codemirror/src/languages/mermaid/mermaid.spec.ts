import { readFileSync } from "node:fs";
import { join } from "node:path";

import { fileTests } from "@lezer/generator/test";
import { describe, expect, it } from "vitest";

import { buildGrammar, listGrammars } from "../../../scripts/build_mermaid_grammars.mjs";
import {
    architectureLanguage,
    blockLanguage,
    c4Language,
    classLanguage,
    erLanguage,
    flowchartLanguage,
    ganttLanguage,
    gitLanguage,
    journeyLanguage,
    kanbanLanguage,
    mermaidLanguage,
    mindmapLanguage,
    packetLanguage,
    pieLanguage,
    quadrantLanguage,
    requirementLanguage,
    sankeyLanguage,
    sequenceLanguage,
    stateLanguage,
    timelineLanguage,
    xychartLanguage
} from "./index.js";

const languages = [
    mermaidLanguage,
    mindmapLanguage,
    pieLanguage,
    flowchartLanguage,
    sequenceLanguage,
    journeyLanguage,
    requirementLanguage,
    ganttLanguage,
    timelineLanguage,
    quadrantLanguage,
    sankeyLanguage,
    xychartLanguage,
    packetLanguage,
    kanbanLanguage,
    blockLanguage,
    architectureLanguage,
    classLanguage,
    stateLanguage,
    erLanguage,
    gitLanguage,
    c4Language
];

describe("Mermaid grammars", () => {
    it("has a committed parser that matches each grammar", () => {
        const grammars = listGrammars();
        expect(grammars.length).toBe(languages.length);
        for (const grammarPath of grammars) {
            for (const [ path, content ] of Object.entries(buildGrammar(grammarPath))) {
                // Run `pnpm --filter @triliumnext/codemirror build:mermaid-grammars` to regenerate.
                expect(readFileSync(path, "utf8"), path).toBe(content);
            }
        }
    });
});

describe.each(languages)("$name grammar", (language) => {
    const fileName = `${language.name}.txt`;
    const file = readFileSync(join(import.meta.dirname, "test", fileName), "utf8");

    for (const { name, run } of fileTests(file, fileName)) {
        it(name, () => run(language.parser));
    }
});
