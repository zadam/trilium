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

    it("gives each method its signature, parameters and return value", () => {
        expect(markdown).toContain([
            "### `resize`",
            "",
            "```ts",
            "resize(options: ResizeOptions): Promise<boolean>",
            "```",
            "",
            "Resizes the window.",
            "",
            "| Parameter | Description |",
            "| --- | --- |",
            "| `options` | `ResizeOptions`<br>How to resize. |",
            "",
            "**Returns** `Promise<boolean>`: Whether it resized."
        ].join("\n"));
        // A function type is written out; a method without a documented return still names its type.
        expect(markdown).toContain("onClose(callback: (reason: string) => void): () => void");
        expect(markdown).toContain("| `callback` | `(reason: string) => void` |");
        expect(markdown).toContain("**Returns** `() => void`");
    });

    it("warns about a deprecated member and writes links as code", () => {
        expect(markdown).toContain([
            "### `maximize`",
            "",
            "```ts",
            "maximize(): void",
            "```",
            "",
            "> [!WARNING]",
            "> Deprecated. Use `resize`."
        ].join("\n"));
        expect(markdown).not.toContain("**Returns** `void`");
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
