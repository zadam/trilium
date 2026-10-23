/**
 * Builds the Flathub flatpak from this checkout's working tree and installs it for the
 * current user as the `local` branch of org.triliumnotes.Trilium, next to any install
 * from Flathub.
 *
 * The manifest is the one ./scripts/flatpak/update-repo.mts writes for Flathub, except
 * that its git source becomes a `dir` source over this checkout: the build sees the files
 * on disk, uncommitted changes included, minus everything git ignores. `.git` stays in,
 * because the manifest stamps the build info from `git log`.
 * `generated-sources.json` is regenerated only when the lockfile changes.
 *
 * Usage:
 *
 *   pnpm exec tsx ./scripts/flatpak/build-local.mts
 *
 * Then run it with `flatpak run --branch=local org.triliumnotes.Trilium`.
 *
 * Builds through the org.flatpak.Builder flatpak. Without `flatpak-node-generator` on
 * PATH, the generator runs on that flatpak's Python from a flatpak-builder-tools
 * checkout under ~/.cache, cloned on first use.
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import { main as generateSources } from "./generate-sources.mjs";
import { MANIFEST_NAME, renderManifest, writePackagingFiles } from "./update-repo.mjs";

const REPO_ROOT = resolve(import.meta.dirname, "../..");
const OUT_DIR = join(REPO_ROOT, "apps/desktop/out/flathub");
const SOURCES_LOCKFILE_STAMP = join(OUT_DIR, "generated-sources.lockfile");
const APP_ID = "org.triliumnotes.Trilium";
const LOCAL_BRANCH = "local";
// Must match the commit .github/workflows/release-flathub.yml installs.
const GENERATOR_COMMIT = "41c20aa10819cdb2a4f3ca171758a96d1955c018";
const GENERATOR_REPO = "https://github.com/flatpak/flatpak-builder-tools.git";

export async function main() {
    mkdirSync(OUT_DIR, { recursive: true });

    const { manifest } = await renderManifest("HEAD");
    const ignored = parseIgnoredPaths(
        git("ls-files", "--others", "--ignored", "--exclude-standard", "--directory")
    );
    writePackagingFiles(OUT_DIR, useLocalDirSource(manifest, REPO_ROOT, ignored));
    updateSources();

    const currentBranch = getCurrentBranch();
    // A Nix shell sets SOURCE_DATE_EPOCH to 1980, which would date the export, and flatpak
    // refuses to install a commit older than the installed one.
    const { SOURCE_DATE_EPOCH: _, ...env } = process.env;
    execFileSync("flatpak", [
        "run", "org.flatpak.Builder",
        "--user", "--install", "--force-clean",
        "--install-deps-from=flathub",
        `--default-branch=${LOCAL_BRANCH}`,
        "builddir", MANIFEST_NAME
    ], { cwd: OUT_DIR, env, stdio: "inherit" });
    // An install becomes the default branch, which the desktop launcher runs on the real data.
    if (currentBranch && currentBranch !== LOCAL_BRANCH) {
        execFileSync("flatpak", [ "make-current", "--user", APP_ID, currentBranch ], {
            stdio: "inherit"
        });
    }
    console.log(`Installed the working tree as the "${LOCAL_BRANCH}" branch.`);
}

/**
 * The branch `flatpak run` picks without `--branch`, if the app is installed. `flatpak info`
 * cannot tell: it refuses to pick one once several branches are installed.
 */
function getCurrentBranch(): string | undefined {
    const userDir = process.env.FLATPAK_USER_DIR ?? join(dataDir(), "flatpak");
    try {
        return basename(readlinkSync(join(userDir, "app", APP_ID, "current")));
    } catch {
        return undefined;
    }
}

/**
 * Replaces the manifest's Trilium git source with a `dir` source over a local checkout.
 * flatpak-builder matches `skip` entries as exact relative paths, not patterns, so each
 * ignored path is listed on its own.
 */
export function useLocalDirSource(manifest: string, repoDir: string, skip: string[]): string {
    const gitSource = new RegExp("^([ \\t]*)- type: git\\n"
        + "[ \\t]*url: https://github\\.com/TriliumNext/Trilium\\.git\\n"
        + "(?:[ \\t]*tag: .*\\n)?"
        + "[ \\t]*commit: .*\\n", "m");
    if (!gitSource.test(manifest)) {
        throw new Error("Found no Trilium git source to replace with the local checkout.");
    }
    return manifest.replace(gitSource, (_, indent: string) => [
        `${indent}- type: dir`,
        `${indent}  path: ${JSON.stringify(repoDir)}`,
        `${indent}  skip:`,
        ...skip.map((path) => `${indent}    - ${JSON.stringify(path)}`),
        ""
    ].join("\n"));
}

/** The `git ls-files --ignored --directory` output as paths, without those inside another. */
export function parseIgnoredPaths(lsFilesOutput: string): string[] {
    const paths = lsFilesOutput.split("\n")
        .map((line) => line.trim().replace(/\/$/, ""))
        .filter(Boolean);
    return paths.filter((path) => !paths.some((other) => path.startsWith(`${other}/`)));
}

/** Regenerates the sources from the working tree's lockfile, unless it is unchanged. */
function updateSources() {
    const lockfileHash = createHash("sha256")
        .update(readFileSync(join(REPO_ROOT, "pnpm-lock.yaml")))
        .digest("hex");
    const sourcesPath = join(OUT_DIR, "generated-sources.json");
    if (existsSync(sourcesPath) && readStamp() === lockfileHash) {
        console.log("The lockfile is unchanged; reusing generated-sources.json.");
        return;
    }
    generateSources([ OUT_DIR ], generatorCommand());
    writeFileSync(SOURCES_LOCKFILE_STAMP, lockfileHash);
}

function readStamp() {
    return existsSync(SOURCES_LOCKFILE_STAMP)
        ? readFileSync(SOURCES_LOCKFILE_STAMP, "utf-8")
        : undefined;
}

function generatorCommand(): string[] {
    try {
        execFileSync("flatpak-node-generator", [ "--help" ], { stdio: "ignore" });
        return [ "flatpak-node-generator" ];
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            throw err;
        }
    }

    // org.flatpak.Builder sees the host's home directory but not its /tmp.
    const cacheDir = process.env.XDG_CACHE_HOME || join(homedir(), ".cache");
    const checkout = join(cacheDir, "flatpak-builder-tools");
    if (!existsSync(checkout)) {
        execFileSync("git", [ "clone", "--quiet", GENERATOR_REPO, checkout ], { stdio: "inherit" });
        execFileSync("git", [ "-C", checkout, "checkout", "--quiet", GENERATOR_COMMIT ], {
            stdio: "inherit"
        });
    }
    return [
        "flatpak", "run", "--command=python3", `--env=PYTHONPATH=${join(checkout, "node")}`,
        "org.flatpak.Builder", "-c", GENERATOR_BOOTSTRAP
    ];
}

// The aiohttp in org.flatpak.Builder (3.10) rejects GitHub's release responses, whose
// headers exceed its 8190-byte default, so the generator's sessions get larger limits.
const GENERATOR_BOOTSTRAP = `\
import functools, runpy, aiohttp
aiohttp.ClientSession.__init__ = functools.partialmethod(
    aiohttp.ClientSession.__init__, max_line_size=65536, max_field_size=65536)
runpy.run_module("flatpak_node_generator", run_name="__main__", alter_sys=True)
`;

function dataDir() {
    return process.env.XDG_DATA_HOME || join(homedir(), ".local/share");
}

function git(...args: string[]): string {
    return execFileSync("git", args, { cwd: REPO_ROOT }).toString().trim();
}

// Only when run as a script — the pure helpers above are imported by the spec.
if (process.argv[1] === import.meta.filename) {
    main().catch((err) => {
        console.error(err instanceof Error ? err.message : err);
        process.exit(1);
    });
}
