import { describe, expect, it } from "vitest";

import { parseIgnoredPaths, useLocalDirSource } from "./build-local.mjs";

const SOURCES = (pin: string) => `\
    sources:
      - type: git
        url: https://github.com/TriliumNext/Trilium.git
${pin}      - generated-sources.json
      - type: archive
        url: https://registry.npmjs.org/@pnpm/exe.linux-x64/-/exe.linux-x64-12.0.0.tgz
`;

describe("useLocalDirSource", () => {
    it("swaps a pinned git source for a dir source and keeps the others", () => {
        const expected = `\
    sources:
      - type: dir
        path: "/home/user/Trilium"
        skip:
          - "node_modules"
          - "apps/client/dist"
      - generated-sources.json
      - type: archive
        url: https://registry.npmjs.org/@pnpm/exe.linux-x64/-/exe.linux-x64-12.0.0.tgz
`;
        const skip = [ "node_modules", "apps/client/dist" ];
        const commit = "        commit: 1234567890abcdef1234567890abcdef12345678\n";
        const tagged = `        tag: v0.106.0\n${commit}`;
        for (const pin of [ commit, tagged ]) {
            expect(useLocalDirSource(SOURCES(pin), "/home/user/Trilium", skip)).toBe(expected);
        }
    });

    it("fails on a manifest without the Trilium git source", () => {
        expect(() => useLocalDirSource("sources: []\n", "/repo", []))
            .toThrow(/no Trilium git source/);
    });
});

describe("parseIgnoredPaths", () => {
    it("strips directory slashes and drops paths inside another ignored one", () => {
        const output = ".flatpak-builder/\n.flatpak-builder/ccache/\napps/client/dist/\n"
            + "apps/client/tsconfig.tsbuildinfo\nnode_modules/\nnode_modules_backup/\n";
        expect(parseIgnoredPaths(output)).toEqual([
            ".flatpak-builder", "apps/client/dist", "apps/client/tsconfig.tsbuildinfo",
            "node_modules", "node_modules_backup"
        ]);
    });
});
