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
const GIT_DIR = /\s-C\s+("[^"]*"|'[^']*'|\S+)/g;
const SEPARATOR = /&&|\|\|?|;|\n/;
const HEREDOC = /<<-?\s*(["']?)(\w+)\1/;

const EXPECTED = "Commit messages written with Claude Code end with a trailer naming the model, "
    + "e.g. `Assisted-by: Claude Code (Claude Opus 5.5)`, and never credit it with "
    + "`Co-Authored-By` (CLAUDE.md, \"Commit messages\"). Add the trailer and commit again.";

/** Returns why `command` must not run, or `null` when it is not a commit with a bad message. */
export function checkCommand(command, cwd) {
    // Quoted text is masked, so `git commit` or a separator inside an argument such as a search
    // pattern is not taken for one, while a quoted `git -C` path still reads as a word.
    const unquoted = command.replace(QUOTED, (quoted) => "_".repeat(quoted.length));
    for (const match of unquoted.matchAll(COMMIT)) {
        const start = match.index;
        const commandEnd = start + match[0].length;
        const variables = readAssignments(command.slice(0, start));
        const gitCwd = readGitDirectory(command.slice(start, commandEnd), cwd, variables);
        const end = findCommitEnd(command, unquoted, commandEnd);
        const reason = checkCommit(command.slice(start, end), gitCwd, variables);
        if (reason) {
            return reason;
        }
    }
    return null;
}

/** The directory git runs in after the `-C` options of `gitCommand`, each relative to the last. */
function readGitDirectory(gitCommand, cwd, variables) {
    let directory = cwd;
    for (const [ , word ] of gitCommand.matchAll(GIT_DIR)) {
        directory = resolve(directory, toNativePath(unquote(word, variables)));
    }
    return directory;
}

/**
 * Where the commit starting before `from` ends: at the next separator, or after the end line of a
 * heredoc it reads its message from.
 */
function findCommitEnd(command, unquoted, from) {
    const separator = unquoted.slice(from).search(SEPARATOR);
    if (separator === -1) {
        return command.length;
    }
    const heredoc = HEREDOC.exec(command.slice(from, from + separator));
    if (!heredoc) {
        return from + separator;
    }
    const delimiter = new RegExp(`\\n\\s*${heredoc[2]}\\s*(?:\\n|$)`);
    const body = delimiter.exec(command.slice(from + separator));
    return body ? from + separator + body.index + body[0].length : command.length;
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
    try {
        return readFileSync(resolve(cwd, toNativePath(path)), "utf8");
    } catch {
        return null;
    }
}

/** Git Bash passes paths such as `/c/Users/...`, which Node on Windows reads as `C:/Users/...`. */
function toNativePath(path) {
    return process.platform === "win32" ? path.replace(/^\/([a-zA-Z])\//, "$1:/") : path;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const input = JSON.parse(readFileSync(0, "utf8"));
    const reason = checkCommand(input.tool_input?.command ?? "", input.cwd ?? process.cwd());
    if (reason) {
        process.stderr.write(`${reason}\n`);
        process.exit(2);
    }
}
