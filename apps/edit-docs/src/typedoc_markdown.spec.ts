import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runTypeDoc, typeDocToMarkdown } from "./typedoc_markdown.js";

const FIXTURE = `
/**
 * The demo API, exposed as \`window.demoApi\`.
 *
 * @packageDocumentation
 */

/** Options of {@link DemoWindowApi.resize}. */
export interface ResizeOptions {
    /** The new width. */
    width: Size;
    animate?: boolean;
}

/** A size in pixels. */
export type Size = number | "auto";

/** An export the root never reaches. */
export interface Unreached {
    flag: boolean;
}

/** Window controls. */
export interface DemoWindowApi {
    /** Whether the window has the focus. */
    readonly focused: boolean;

    /**
     * Resizes the window.
     *
     * @param options How to resize.
     * @returns Whether it resized.
     */
    resize(options: ResizeOptions): Promise<boolean>;

    /** Calls back when the window closes. */
    onClose(callback: (reason: string) => void): () => void;

    /** @deprecated Use {@link resize}. */
    maximize(): void;
}

/** The root of the API. */
export interface DemoApi {
    /** Window controls. */
    window: DemoWindowApi;
    /** The version, as in \`1.2.3\`. */
    readonly version: string;
}
`;

describe("typeDocToMarkdown", () => {
    let dir: string;
    let markdown: string;

    beforeAll(async () => {
        dir = await mkdtemp(join(tmpdir(), "typedoc-markdown-"));
        await writeFile(join(dir, "api.ts"), FIXTURE);
        await writeFile(join(dir, "tsconfig.json"), JSON.stringify({
            compilerOptions: { strict: true, target: "ES2022", module: "ESNext", moduleResolution: "bundler" },
            files: [ "api.ts" ]
        }));
        markdown = typeDocToMarkdown(await runTypeDoc(join(dir, "api.ts"), join(dir, "tsconfig.json")), "DemoApi");
    }, 60_000);

    afterAll(async () => {
        await rm(dir, { recursive: true, force: true });
    });

    /** The row of the members table that documents `name`, which nested tables are part of. */
    const row = (name: string) => {
        const start = markdown.indexOf(`<td><code>${name}</code>`);
        expect(start).toBeGreaterThan(-1);
        return markdown.slice(start, markdown.indexOf("\n        </tr>", start));
    };

    it("opens with the package comment, then the root and what it reaches, in order of reference", () => {
        expect(markdown.startsWith("The demo API, exposed as `window.demoApi`.\n\n## `DemoApi`")).toBe(true);

        const order = [ ...markdown.matchAll(/^## `(\w+)`/gm) ].map(([ , name ]) => name);
        // Exports the root never reaches follow, in source order.
        expect(order).toEqual([ "DemoApi", "DemoWindowApi", "ResizeOptions", "Size", "Unreached" ]);
    });

    it("lists properties in a table, their type above their description", () => {
        expect(markdown).toContain([
            "## `DemoApi`",
            "",
            "The root of the API.",
            "",
            "| Property | Description |",
            "| --- | --- |",
            "| `window` | `DemoWindowApi`<br>Window controls. |",
            "| `version` | `string`<br>The version, as in `1.2.3`. |"
        ].join("\n"));
        // An optional property says so under its name; a union's pipe is escaped in its cell.
        expect(markdown).toContain("| `width` | `Size`<br>The new width. |");
        expect(markdown).toContain("| `animate`<br>*optional* | `boolean` |");
    });

    it("lists the members of an interface with methods in one HTML table, in the export's layout", () => {
        const section = markdown.slice(markdown.indexOf("## `DemoWindowApi`"), markdown.indexOf("## `ResizeOptions`"));
        expect(section).toContain([
            "<table>",
            "    <thead>",
            "        <tr>",
            "            <th>Member</th>",
            "            <th>Description</th>",
            "        </tr>",
            "    </thead>",
            "    <tbody>",
            "        <tr>",
            "            <td><code>focused</code></td>"
        ].join("\n"));
        // A blank line would end the HTML block when the page is imported.
        const table = section.slice(section.indexOf("<table>"), section.indexOf("</table>\n") + 8);
        expect(table).not.toMatch(/\n[ \t]*\n/);
        expect(row("focused")).toContain("<code>boolean</code><br>Whether the window has the focus.");
    });

    it("gives a method its signature and description, and parameters and return only when documented", () => {
        const resize = row("resize");
        expect(resize).toMatch(/<pre><code class="language-[^"]+">resize\(options: ResizeOptions\): Promise&lt;boolean&gt;<\/code><\/pre>/);
        expect(resize).toContain("<p>Resizes the window.</p>");
        expect(resize).toMatch(/<th>Parameter<\/th>.*<td><code>options<\/code><\/td><td><code>ResizeOptions<\/code><br>How to resize.<\/td>/);
        expect(resize).toContain("<strong>Returns</strong> <code>Promise&lt;boolean&gt;</code>: Whether it resized.");

        // Without descriptions, the signature already says everything a table or a Returns line would.
        const onClose = row("onClose");
        expect(onClose).toContain("onClose(callback: (reason: string) =&gt; void): () =&gt; void");
        expect(onClose).not.toContain("<table>");
        expect(onClose).not.toContain("Returns");
    });

    it("warns about a deprecated member and writes links as code", () => {
        expect(row("maximize")).toMatch(/<aside class="admonition warning">.*Deprecated. Use <code>resize<\/code>./);
        expect(markdown).toContain("Options of `DemoWindowApi.resize`.");
    });

    it("writes a type alias as its declaration", () => {
        expect(markdown).toContain([
            "## `Size`",
            "",
            "A size in pixels.",
            "",
            "```ts",
            "type Size = number | \"auto\"",
            "```"
        ].join("\n"));
    });
});
