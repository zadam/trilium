// Run with `node --test .claude/hooks/check-commit-attribution.test.mjs`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { checkCommand } from "./check-commit-attribution.mjs";

const TRAILER = "Assisted-by: Claude Code (Claude Opus 5.5)";
const dir = mkdtempSync(join(tmpdir(), "commit-attribution-"));

function message(name, text) {
    writeFileSync(join(dir, name), text);
    return name;
}

describe("checkCommand", () => {
    it("passes commands that do not commit, or commit without a message of their own", () => {
        for (const command of [
            "git status --short",
            "grep -rn \"git commit -m wip\" docs",
            "grep -E \"^# pass|git commit -m wip\" out.txt",
            "git log --oneline -5",
            "git commit --amend --no-edit",
            "git commit-graph write"
        ]) {
            assert.equal(checkCommand(command, dir), null, command);
        }
    });

    it("passes a message carrying the trailer, inline or in a file", () => {
        const good = message("good.txt", `fix(x): y\n\nBody.\n\n${TRAILER}\n`);
        for (const command of [
            `git commit -F ${good} -- a.ts`,
            `git add a.ts && git -C . commit --file="${good}"`,
            `git commit -m "fix(x): y" -m "${TRAILER}"`,
            `git commit -F - <<'EOF'\nfix(x): y\n\n${TRAILER}\nEOF`,
            `git commit-tree HEAD^{tree} -p HEAD -F ${good}`
        ]) {
            assert.equal(checkCommand(command, dir), null, command);
        }
    });

    it("blocks a message without the trailer, with a placeholder model, or crediting Claude as co-author", () => {
        const none = message("none.txt", "fix(x): y\n");
        const placeholder = message("placeholder.txt", "fix(x): y\n\nAssisted-by: Claude Code (<model>)\n");
        const coAuthor = message("co-author.txt",
            `fix(x): y\n\n${TRAILER}\nCo-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>\n`);
        for (const command of [
            `git commit -F ${none} -- a.ts`,
            `git commit -F ${placeholder}`,
            `git commit -F ${coAuthor}`,
            "git commit -am \"fix(x): y\"",
            "git commit -m \"fix(x): y\" -m \"Assisted-by: Claude Code\"",
            "cd sub; git commit --message=wip",
            "git commit -F missing.txt",
            `git commit -m a -m "${TRAILER}"; git commit -m b`
        ]) {
            assert.match(checkCommand(command, dir) ?? "", /Assisted-by: Claude Code \(/, command);
        }
    });
});

describe("the hook", () => {
    const script = fileURLToPath(new URL("./check-commit-attribution.mjs", import.meta.url));
    const run = (command) => spawnSync(process.execPath, [ script ], {
        input: JSON.stringify({ tool_name: "Bash", tool_input: { command }, cwd: dir }),
        encoding: "utf8"
    });

    it("exits with 2 and explains a blocked commit, and with 0 otherwise", () => {
        const blocked = run("git commit -m wip");
        assert.equal(blocked.status, 2);
        assert.match(blocked.stderr, /Assisted-by/);

        assert.equal(run("git status").status, 0);
    });
});
