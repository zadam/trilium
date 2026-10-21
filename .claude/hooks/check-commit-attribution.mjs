// A `PreToolUse` hook (see `.claude/settings.json`): blocks a `git commit` or `git commit-tree`
// whose message lacks the `Assisted-by` trailer that CLAUDE.md requires, naming the model.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** `git` at the start of a command, with its global options, running `commit` or `commit-tree`. */
const COMMIT = /(?:^|[;&|(\n]\s*)git(?:\s+-[cC]\s+\S+|\s+--\S+)*\s+commit(?:-tree)?(?=\s|$)/g;
const QUOTED = /"[^"]*"|'[^']*'/g;
const MESSAGE_FLAG = /\s(?:-[a-zA-Z]*[mF]|--message|--file)(?=[\s"'=]|$)/;
const FILE_FLAG = /\s(?:-F\s*|--file[=\s]\s*)("[^"]+"|'[^']+'|[^\s;&|]+)/g;
const TRAILER = /Assisted-by: Claude Code \([^()<>\n"']+\)/;
const CO_AUTHOR = /Co-Authored-By: Claude/i;
/** `NAME=value` at the start of a command, as `S="…" && git commit -F "$S/msg.txt"` sets. */
const ASSIGNMENT = /(?:^|[;&|(\n]\s*)(?:export\s+)?([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s;&|]*)/g;
const VARIABLE = /\$\{(\w+)\}|\$(\w+)/g;

const EXPECTED = "Commit messages written with Claude Code end with a trailer naming the model, "
    + "e.g. `Assisted-by: Claude Code (Claude Opus 5.5)`, and never credit it with "
    + "`Co-Authored-By` (CLAUDE.md, \"Commit messages\"). Add the trailer and commit again.";

/** Returns why `command` must not run, or `null` when it is not a commit with a bad message. */
export function checkCommand(command, cwd) {
    // Quoted text is blanked out, so `git commit` inside an argument such as a search pattern is
    // not taken for a commit.
    const unquoted = command.replace(QUOTED, (quoted) => " ".repeat(quoted.length));
    const starts = [ ...unquoted.matchAll(COMMIT) ].map((match) => match.index);
    for (const [ index, start ] of starts.entries()) {
        const variables = readAssignments(command.slice(0, start));
        const reason = checkCommit(command.slice(start, starts[index + 1]), cwd, variables);
        if (reason) {
            return reason;
        }
    }
    return null;
}

function checkCommit(args, cwd, variables) {
    if (!MESSAGE_FLAG.test(args)) {
        // No message of its own, as with `--amend --no-edit`.
        return null;
    }

    const messages = [ args ];
    for (const [ , quoted ] of args.matchAll(FILE_FLAG)) {
        const path = unquote(quoted, variables);
        if (path === "-") {
            continue;
        }
        const text = readMessage(path, cwd);
        if (text === null) {
            return unreadable(path);
        }
        messages.push(text);
    }

    const hasTrailer = messages.some((text) => TRAILER.test(text));
    const hasCoAuthor = messages.some((text) => CO_AUTHOR.test(text));
    return hasTrailer && !hasCoAuthor ? null : EXPECTED;
}

/**
 * The variables the shell has set by the end of `command`, from its assignments, each expanded
 * with the ones before it as the shell does.
 */
function readAssignments(command) {
    const variables = {};
    for (const [ , name, value ] of command.matchAll(ASSIGNMENT)) {
        variables[name] = unquote(value, variables);
    }
    return variables;
}

/** A shell word as the shell reads it: single quotes taken literally, any other expanded. */
function unquote(word, variables) {
    if (word.startsWith("'")) {
        return word.slice(1, -1);
    }
    return word.replace(/^"|"$/g, "").replace(VARIABLE, (whole, braced, bare) => {
        const name = braced ?? bare;
        return variables[name] ?? process.env[name] ?? whole;
    });
}

function unreadable(path) {
    return `Could not read the commit message file \`${path}\`. This hook runs before the command, `
        + "so a file the same command writes does not exist yet: write the message in a separate "
        + "command first, then commit with its path.";
}

function readMessage(path, cwd) {
    // Git Bash passes paths such as `/c/Users/...`, which Node on Windows reads as `C:/Users/...`.
    const nativePath = process.platform === "win32"
        ? path.replace(/^\/([a-zA-Z])\//, "$1:/")
        : path;
    try {
        return readFileSync(resolve(cwd, nativePath), "utf8");
    } catch {
        return null;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const reason = checkCommand(input.tool_input?.command ?? "", input.cwd ?? process.cwd());
    if (reason) {
        process.stderr.write(`${reason}\n`);
        process.exit(2);
    }
}
