---
name: developing-mermaid-highlighting
description: Use when changing how Mermaid diagram source is highlighted in Trilium's code editor — the Lezer grammars vendored in `packages/codemirror/src/languages/mermaid/` (`parsers/<diagram>/<diagram>.grammar`, `tokens.ts`, `highlight.ts`, `tags/`, the `mermaid` dispatcher grammar, `index.ts`), adding highlighting for a diagram type it does not know yet (radar, treemap, Venn, railroad, …), fixing a diagram that highlights wrongly, the `test/<diagram>.txt` fixtures, `scripts/build_mermaid_grammars.mts`, or the `text/vnd.mermaid` entry in `syntax_highlighting.ts`. Covers regenerating the committed parsers, the checklist for a new diagram type, the Lezer traps already hit (precedence beats length, external-tokenizer order, CRLF), and how to prove a grammar change (fixtures first, real Mermaid as the referee, tree comparison over a generated corpus). Includes tree.mts, fixtures.mts and compare.mts — don't write new parse-tree probes.
---

# Developing Mermaid syntax highlighting

A Mermaid note is highlighted by a Lezer language in `packages/codemirror/src/languages/mermaid/`,
loaded by `syntax_highlighting.ts` for the `text/vnd.mermaid` and `text/mermaid` MIME types. It was
vendored from [Edge-Tools/codemirror-lang-mermaid](https://github.com/Edge-Tools/codemirror-lang-mermaid)
at `03bcd7d`, itself a fork of inspirnathan's `codemirror-lang-mermaid`. Both upstreams are dormant:
**the code is ours now**. Never re-vendor over it; `git log -- packages/codemirror/src/languages/mermaid`
shows what changed after the verbatim copy and why.

## Layout

```
languages/mermaid/
  index.ts              mermaid(), mermaidLanguage, DIAGRAM_PARSERS; re-exports foldByIndent()
  extensions/index.ts   foldByIndent() — folds a line with the deeper-indented lines after it
  tags/index.ts         highlight tags, one set per diagram
  parsers/mermaid/      the dispatcher: detects the diagram type from the first meaningful line
  parsers/<diagram>/    <diagram>.grammar, tokens.ts (external tokenizers, optional),
                        highlight.ts (styleTags), parser.ts + parser.terms.ts (GENERATED)
  test/<diagram>.txt    Lezer fixtures, one file per parsers/ directory, same name
  mermaid.spec.ts       runs every fixture file, checks generated parsers are current
  LICENSE               upstream MIT licence — keep it
```

How a document parses: `mermaid.grammar` skips the preamble (front matter, `%%{init}%%`, blank
lines) as `preDiagramLine`s, then its `diagramText` tokenizer (`parsers/mermaid/tokens.ts`) matches
the first other line against `diagramMap` and emits one node for the rest of the document, such as
`FlowchartDiagram`. `parseMixed()` in `index.ts` looks that node's name up in `DIAGRAM_PARSERS` and
mounts the diagram's own parser over it. A diagram with no entry there, or a keyword missing from
`diagramMap`, gets no highlighting at all.

## Rules

- **Never edit `parser.ts` or `parser.terms.ts`.** After any `.grammar` change, regenerate:
  `pnpm --filter @triliumnext/codemirror build:mermaid-grammars`. The spec fails while a committed
  parser differs from what its grammar generates. The parsers are committed because the client
  consumes `packages/codemirror` as source, and no Vite/Vitest config compiles `.grammar` files.
- **Relative imports end in `.js`** (`nodenext`), in TypeScript and in a grammar's
  `@external … from "./tokens.js"` alike.
- **Run the narrow suite**: `pnpm --filter @triliumnext/codemirror test src/languages/mermaid`
  (add `syntax_highlighting` when touching the wiring). Then `pnpm typecheck` once.
- **The package gates on 100% coverage** in CI (`pnpm run --filter=codemirror test --coverage`),
  and vendored code counts. Measure just this folder:
  ```bash
  cd packages/codemirror && pnpm exec vitest run src/languages/mermaid \
    --coverage --coverage.include='src/languages/mermaid/**/*.ts' --coverage.reporter=json-summary
  ```
  then read `test-output/vitest/coverage/coverage-summary.json`. The text table hides rows that are
  at 100%, so read totals rather than inferring them from missing output. Generated parsers are
  excluded from coverage (`vite.config.ts`) and from the formatter (`eslint.format.config.mjs`).
- **Format check** only the folder:
  `pnpm exec eslint -c eslint.format.config.mjs packages/codemirror/src/languages/mermaid`.

## Adding a diagram type

Twelve built-in Mermaid types have no grammar yet: radar, treemap, tree view, event modeling,
Ishikawa, Venn, use case, Wardley, Cynefin, railroad (four dialects), swimlane, agent flow. The
official VS Code extension (Mermaid-Chart/vscode-mermaid-chart, MIT, `syntaxes/`) has a TextMate
grammar for radar; the rest have none anywhere, so write them from Mermaid's syntax docs.

1. **`parsers/<diagram>/<diagram>.grammar`.** Its `@top` node is named `<Something>Diagram`. Start
   from the closest existing grammar: line-oriented diagrams (pie, packet, sankey) are small;
   indentation-based ones (mindmap, kanban) need a context tracker.
2. **`highlight.ts`** maps node names to tags with `styleTags`, using `@external propSource … from
   "./highlight.js"` in the grammar. **`tokens.ts`** only if the grammar needs external tokenizers.
3. **Tags** go in `tags/index.ts`. Give each one a standard parent
   (`Tag.define(t.keyword)`): themes style standard tags only, so a parentless tag renders unstyled
   (mindmap's `lineText1..5` are, deliberately or not).
4. **Teach the dispatcher.** In `parsers/mermaid/mermaid.grammar`, add the node to both the `@top`
   alternatives and the `@external tokens diagramText` list; in `parsers/mermaid/tokens.ts` add each
   keyword the diagram starts with to `diagramMap` (`radar-beta`, …). `diagramMap` matches with
   `startsWith` and takes the first hit, so list a longer key before a shorter key it starts with.
5. **Wire it** into `DIAGRAM_PARSERS` in `index.ts`, keyed by the node name. The spec fails if a
   parser directory is missing from the map.
6. **Fixtures**: `test/<diagram>.txt`, named exactly like the directory. Start with Trilium's own
   sample for the type (`apps/client/src/widgets/type_widgets/mermaid/sample_diagrams.ts`), then one
   case per construct. Add a detection case to `test/mermaid.txt`.
7. Regenerate, run the suite, measure coverage.

## Lezer traps already hit

- **`@precedence` beats length.** A higher-precedence token wins even where a lower one would match
  more. Flowchart's `--` label opener ranked below the link tokens, so `-- text -->` always lexed as
  a link: the edge-label rule could never match, and upstream fixtures recorded the broken tree.
  The fix made the opener longer (`"--" $[ \t]+`) so no link token overlaps it, then ranked it first.
- **External tokenizers run in declaration order; the first that accepts wins.** Kanban's
  `columnTitleTokens` claims every line without a `[`, so `nodeIdTokens` only ever sees card lines.
  Check what an earlier tokenizer swallows before deciding a later one's branch is reachable.
- **`acceptToken(term, offset)`** with a negative offset ends the token before what was read —
  kanban uses it to keep the spaces in `id1 [Task]` out of the id. Fixture trees do not show token
  ranges; assert those in the spec, or look with `tree.mts --spans`.
- **Line endings.** CodeMirror normalizes `\r\n` and `\r` to `\n` before parsing, but the grammars
  still meet CRLF in specs and anywhere else they run. Git normalizes CRLF in `.txt` fixtures, so a
  CRLF case belongs in `mermaid.spec.ts` (`parses Windows line endings like Unix ones`).
- **Language data lives on top nodes.** `state.languageDataAt()` reads it from the innermost top
  node at a position, which inside a diagram is that diagram's own top node, not `MermaidDiagram`.
  `languageData` on `mermaidLanguage` alone reaches only the preamble, so `index.ts` configures every
  diagram parser with `languageDataProp` pointing at `mermaidLanguage.data` (that is how `%%`
  comment toggling, `commentTokens`, reaches the diagram body). Add new data (autocompletion
  sources, indentation hints) to `languageData`, never to one diagram parser.
- **Error recovery is behaviour too.** A fixture whose tree has `⚠` pins how the grammar recovers.
  That is fine for input Mermaid rejects; for input Mermaid accepts it records a limitation, and the
  fixture name must say so (`… (unsupported, parses as empty lines)`).

## Proving a change

**Fixtures first.** Write or correct the fixture, run it red against the current grammar, then fix.
`fixtures.mts` generates fixture blocks from the current parser — that is for recording behaviour
you have already judged correct, never for deciding what correct is.

**Real Mermaid is the referee** on what syntax is valid. Before pinning a tree for an odd input, ask
Mermaid, from a throwaway client spec (delete it afterwards):

```ts
// apps/client/src/zz_probe.spec.ts
import mermaid from "mermaid";
import { it } from "vitest";
it("probe", async () => {
    for (const code of [ "kanban\n  todo\n    id1 [Task]", "mindmap root" ]) {
        try { await mermaid.parse(code); console.log("OK ", code); }
        catch (e) { console.log("ERR", code, (e as Error).message.split("\n")[0]); }
    }
});
```

run with `cd apps/client && pnpm exec vitest run src/zz_probe.spec.ts`. The upstream fixtures were
written against the parser, not against Mermaid, and some recorded bugs as expected output.

**A refactor that claims "no behaviour change" needs proof, not reasoning.** Record the trees,
change the code, check:

```bash
K=.claude/skills/developing-mermaid-highlighting
npx tsx $K/compare.mts record mindmap /tmp/before.json
# … change, regenerate if a grammar changed …
npx tsx $K/compare.mts check mindmap /tmp/before.json
```

The corpus recombines the lines of the diagram's fixtures (2000 documents, LF and CRLF) and
compares every node with its range. Then **break the changed line on purpose once** and confirm
`check` reports differences — a corpus that never reaches the code passes everything. Both halves
have caught real mistakes: a mindmap check that a handful of hand-picked documents never reached
(logging suggested it was dead; 98 corpus documents changed without it), and a token-range change
that an earlier name-only comparison missed.

**Before deleting a branch as unreachable**, log what reaches it across the corpus, not across a
few documents you wrote. If the corpus reaches it, it needs a fixture; if neither the corpus nor
any document Mermaid accepts reaches it, remove it, and say how you know in the commit.

## Tools

| | does |
|---|---|
| `tree.mts <diagram> '<input>' [--spans]` | prints the parse tree; `--spans` adds each node's range and text. `mermaid` parses with the top-level language |
| `fixtures.mts <cases.json> [--append]` | `[diagram, name, input][]` → fixture blocks from the current parser; `--append` writes them to `test/<diagram>.txt` |
| `compare.mts record\|check <diagram> <file>` | before/after tree comparison over a generated corpus |

All run with `npx tsx .claude/skills/developing-mermaid-highlighting/<script>` from the repository
root; `\n`, `\r` and `\t` in an input are unescaped.

## Known limitations

- `mindmap root` (root on the `mindmap` line, valid Mermaid) parses as empty lines.
- A bare word under a kanban column parses as another column, not a card.
- Dotted edge labels (`A -. text .-> B`) parse as two links.
- No autocompletion exists for Mermaid in any editor library; it would be an
  `@codemirror/autocomplete` source written here.
