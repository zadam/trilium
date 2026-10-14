// Shared by replay.mjs and compare.mjs: finding a development recording and its transcripts.

import fs from "node:fs";
import path from "node:path";

export const TRANSCRIPT_VERSION = 1;

/** Where `pnpm desktop:start` keeps recordings (its TRILIUM_DATA_DIR is apps/desktop/data). */
const DEV_RECORDINGS_DIR = path.resolve(
    import.meta.dirname, "../../../apps/desktop/data/transcription-recordings");

/**
 * Splits argv into positional arguments and `--name value` options. Names in `multiple` collect
 * every value into an array; names in `flags` take no value.
 */
export function parseArgs(argv, { multiple = [], flags = [] } = {}) {
    const positional = [];
    const options = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (!arg.startsWith("--")) {
            positional.push(arg);
            continue;
        }
        const name = arg.slice(2);
        if (flags.includes(name)) {
            options[name] = true;
            continue;
        }
        const value = argv[++i];
        if (value === undefined) {
            throw new Error(`--${name} needs a value.`);
        }
        if (multiple.includes(name)) {
            (options[name] ??= []).push(value);
        } else {
            options[name] = value;
        }
    }
    return { positional, options };
}

/**
 * Reads the recording in `argument`, a recording directory or `latest` (the newest recording of
 * the development data directory).
 */
export function resolveRecording(argument) {
    let directory = argument;
    if (!argument || argument === "latest") {
        const names = fs.existsSync(DEV_RECORDINGS_DIR)
            ? fs.readdirSync(DEV_RECORDINGS_DIR).sort()
            : [];
        if (!names.length) {
            throw new Error(`No recordings in ${DEV_RECORDINGS_DIR}.`);
        }
        directory = path.join(DEV_RECORDINGS_DIR, names.at(-1));
    }
    const manifestPath = path.join(directory, "recording.json");
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`${directory} is not a recording: it has no recording.json.`);
    }
    return { directory, manifest: JSON.parse(fs.readFileSync(manifestPath, "utf8")) };
}

/** The transcript file of `label`: `live` is the one written while recording. */
export function transcriptPath(directory, label) {
    return path.join(directory, label === "live" ? "transcript.json" : `transcript.${label}.json`);
}

/** Every transcript in a recording directory, by label. */
export function listTranscripts(directory) {
    const transcripts = new Map();
    for (const name of fs.readdirSync(directory).sort()) {
        const match = /^transcript(?:\.(.+))?\.json$/.exec(name);
        if (match) {
            transcripts.set(match[1] ?? "live", readTranscript(directory, match[1] ?? "live"));
        }
    }
    return transcripts;
}

export function readTranscript(directory, label) {
    const filePath = transcriptPath(directory, label);
    if (!fs.existsSync(filePath)) {
        throw new Error(`No transcript "${label}" in ${directory} (${path.basename(filePath)}).`);
    }
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
}
