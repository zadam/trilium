#!/usr/bin/env node
// Transcribes a development recording again, with the settings it was recorded with plus any
// overrides, and writes transcript.<label>.json beside the live transcript.json.
//
//   node replay.mjs <recording dir | latest> --label <name> [options]
//
//   --set <path>=<value>   override a setting from recording.json's `engine`, e.g.
//                          --set recognizer.decodingMethod=modified_beam_search
//                          --set recognizer.maxActivePaths=8 --set vad.threshold=0.4
//                          (the value is parsed as JSON when it parses, else kept as a string)
//   --hotwords <a/b/c>     per-utterance hotwords, separated by "/" (needs modified_beam_search)
//   --model <dir>          model directory (default: <data dir>/transcription-model)
//   --source <name>        replay only microphone or system
//   --pad <seconds>        extend each segment by this much audio on both sides before decoding
//   --force                overwrite an existing transcript.<label>.json
//
// Runs in plain Node (no Electron) with the sherpa-onnx-node the desktop app depends on.

import fs from "node:fs";
import path from "node:path";

import {
    parseArgs, resolveRecording, TRANSCRIPT_VERSION, transcriptPath
} from "./recordings.mjs";
import { loadSherpa, SAMPLE_RATE, segmentSource } from "./sherpa.mjs";

const DEFAULT_THREADS = 2;
/** Recognizer settings that sherpa-onnx reads from `modelConfig`; the rest sit at the top level. */
const MODEL_CONFIG_KEYS = new Set([
    "modelType", "numThreads", "provider", "modelingUnit", "bpeVocab", "debug"
]);

const { positional, options } = parseArgs(process.argv.slice(2), {
    multiple: [ "set" ], flags: [ "force" ]
});
const recording = resolveRecording(positional[0]);
const label = options.label;
if (!label || !/^[\w.-]+$/.test(label) || label === "live") {
    fail("Give a --label of letters, digits, '.', '_' or '-' (not 'live').");
}
const outputPath = transcriptPath(recording.directory, label);
if (fs.existsSync(outputPath) && !options.force) {
    fail(`${outputPath} exists; pass --force to replace it.`);
}

const engine = structuredClone(recording.manifest.engine ?? {});
for (const assignment of options.set ?? []) {
    applySetting(engine, assignment);
}
const modelDirectory = options.model
    ?? path.join(path.dirname(path.dirname(recording.directory)), "transcription-model");
const hotwords = options.hotwords;
const padSamples = Math.round(Number(options.pad ?? 0) * SAMPLE_RATE);
if (hotwords && engine.recognizer?.decodingMethod !== "modified_beam_search") {
    console.warn("Warning: hotwords apply only with "
        + "--set recognizer.decodingMethod=modified_beam_search; they will be ignored.");
}

const sherpa = loadSherpa();
console.log(`Loading the model from ${modelDirectory}…`);
const loadStarted = performance.now();
const recognizer = await sherpa.OfflineRecognizer.createAsync(
    buildRecognizerConfig(engine.recognizer ?? {}, modelDirectory));
const loadMs = performance.now() - loadStarted;

const utterances = [];
const sourceStats = {};
for (const [ source, { file, firstSampleOffsetMs } ] of Object.entries(recording.manifest.sources)) {
    if (options.source && options.source !== source) {
        continue;
    }
    const wave = sherpa.readWave(path.join(recording.directory, file));
    if (wave.sampleRate !== SAMPLE_RATE) {
        fail(`${file} is ${wave.sampleRate} Hz; the engine expects ${SAMPLE_RATE} Hz.`);
    }

    let decodeMs = 0;
    let segmentCount = 0;
    for (const segment of segmentSource(sherpa, wave.samples, engine.vad ?? {}, modelDirectory)) {
        const stream = hotwords ? recognizer.createStream(hotwords) : recognizer.createStream();
        const samples = padSamples
            ? wave.samples.subarray(Math.max(0, segment.start - padSamples),
                segment.start + segment.samples.length + padSamples)
            : segment.samples;
        stream.acceptWaveform({ samples, sampleRate: SAMPLE_RATE });
        const decodeStarted = performance.now();
        const text = (await recognizer.decodeAsync(stream)).text.trim();
        decodeMs += performance.now() - decodeStarted;
        segmentCount++;
        if (text) {
            utterances.push({
                source,
                offsetMs: firstSampleOffsetMs + segment.start / SAMPLE_RATE * 1000,
                durationMs: segment.samples.length / SAMPLE_RATE * 1000,
                text
            });
        }
    }
    const audioSeconds = wave.samples.length / SAMPLE_RATE;
    sourceStats[source] = {
        audioSeconds, segments: segmentCount, decodeMs, rtf: decodeMs / 1000 / audioSeconds
    };
    console.log(`${source}: ${segmentCount} segments, ${audioSeconds.toFixed(1)} s of audio `
        + `decoded in ${(decodeMs / 1000).toFixed(1)} s (RTF ${sourceStats[source].rtf.toFixed(3)})`);
}
utterances.sort((a, b) => a.offsetMs - b.offsetMs);

fs.writeFileSync(outputPath, JSON.stringify({
    version: TRANSCRIPT_VERSION,
    startedAt: recording.manifest.startedAt,
    utterances,
    replay: {
        label,
        createdAt: new Date().toISOString(),
        engine: { ...engine, modelDirectory },
        hotwords: hotwords ?? null,
        padSeconds: padSamples / SAMPLE_RATE,
        loadMs,
        sources: sourceStats
    }
}, null, 2));
console.log(`Wrote ${outputPath}`);

function buildRecognizerConfig(settings, modelDir) {
    const modelConfig = {
        transducer: {
            encoder: path.join(modelDir, "encoder.int8.onnx"),
            decoder: path.join(modelDir, "decoder.int8.onnx"),
            joiner: path.join(modelDir, "joiner.int8.onnx")
        },
        tokens: path.join(modelDir, "tokens.txt"),
        numThreads: DEFAULT_THREADS
    };
    const config = { featConfig: { sampleRate: SAMPLE_RATE, featureDim: 80 }, modelConfig };
    for (const [ key, value ] of Object.entries(settings)) {
        (MODEL_CONFIG_KEYS.has(key) ? modelConfig : config)[key] = value;
    }
    return config;
}

function applySetting(target, assignment) {
    const separator = assignment.indexOf("=");
    if (separator < 1) {
        fail(`--set takes <path>=<value>, got "${assignment}".`);
    }
    const keys = assignment.slice(0, separator).split(".");
    const raw = assignment.slice(separator + 1);
    let value;
    try {
        value = JSON.parse(raw);
    } catch {
        value = raw;
    }
    let node = target;
    for (const key of keys.slice(0, -1)) {
        node[key] ??= {};
        node = node[key];
    }
    node[keys.at(-1)] = value;
}

function fail(message) {
    console.error(message);
    process.exit(1);
}
