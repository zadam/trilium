import { TRANSCRIPTION_RESOURCES } from "@triliumnext/commons";
import dataDirs from "@triliumnext/server/src/services/data_dir.js";
import resources, { type ResourceDefinition } from "@triliumnext/server/src/services/resources.js";
import fs from "fs";
import { t } from "i18next";
import path from "path";

import type { ModelPaths } from "./protocol";

/**
 * A model directory installed by hand, which takes precedence over the downloaded models: it can
 * hold the full-precision Parakeet model, which `loadSherpaEngine()` prefers.
 */
export const LOCAL_MODEL_DIR = path.join(dataDirs.TRILIUM_DATA_DIR, "transcription-model");

const VAD_FILE = "silero_vad.onnx";
const SPEAKER_FILE = "nemo_en_titanet_small.onnx";

const PARAKEET = "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/2bda32ec70b097a55adaa07d9a7173915b43cc78";
const SHERPA_RELEASES = "https://github.com/k2-fsa/sherpa-onnx/releases/download";

/** Parakeet TDT 0.6B v3, int8: the files `loadSherpaEngine()` reads from its recognizer directory. */
export const RECOGNIZER_MODEL: ResourceDefinition = {
    id: TRANSCRIPTION_RESOURCES.recognizer,
    version: "v3-int8-2bda32ec",
    title: () => t("transcription.recognizer-title"),
    description: () => t("transcription.recognizer-description"),
    icon: "bx bx-captions",
    findLocalCopy: () => fs.existsSync(LOCAL_MODEL_DIR) ? LOCAL_MODEL_DIR : null,
    files: [
        {
            path: "encoder.int8.onnx",
            url: `${PARAKEET}/encoder.int8.onnx`,
            size: 652184281,
            sha256: "acfc2b4456377e15d04f0243af540b7fe7c992f8d898d751cf134c3a55fd2247"
        },
        {
            path: "decoder.int8.onnx",
            url: `${PARAKEET}/decoder.int8.onnx`,
            size: 11845275,
            sha256: "179e50c43d1a9de79c8a24149a2f9bac6eb5981823f2a2ed88d655b24248db4e"
        },
        {
            path: "joiner.int8.onnx",
            url: `${PARAKEET}/joiner.int8.onnx`,
            size: 6355277,
            sha256: "3164c13fc2821009440d20fcb5fdc78bff28b4db2f8d0f0b329101719c0948b3"
        },
        {
            path: "tokens.txt",
            url: `${PARAKEET}/tokens.txt`,
            size: 93939,
            sha256: "d58544679ea4bc6ac563d1f545eb7d474bd6cfa467f0a6e2c1dc1c7d37e3c35d"
        }
    ]
};

export const VAD_MODEL: ResourceDefinition = {
    id: TRANSCRIPTION_RESOURCES.vad,
    version: "1",
    title: () => t("transcription.vad-title"),
    description: () => t("transcription.vad-description"),
    icon: "bx bx-pulse",
    findLocalCopy: () => fs.existsSync(path.join(LOCAL_MODEL_DIR, VAD_FILE)) ? LOCAL_MODEL_DIR : null,
    files: [ {
        path: VAD_FILE,
        url: `${SHERPA_RELEASES}/asr-models/${VAD_FILE}`,
        size: 643854,
        sha256: "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6"
    } ]
};

export const SPEAKER_MODEL: ResourceDefinition = {
    id: TRANSCRIPTION_RESOURCES.speaker,
    version: "1",
    title: () => t("transcription.speaker-title"),
    description: () => t("transcription.speaker-description"),
    icon: "bx bx-user-voice",
    findLocalCopy: () => {
        const directory = path.join(LOCAL_MODEL_DIR, "speaker");
        return fs.existsSync(path.join(directory, SPEAKER_FILE)) ? directory : null;
    },
    files: [ {
        path: SPEAKER_FILE,
        url: `${SHERPA_RELEASES}/speaker-recongition-models/${SPEAKER_FILE}`,
        size: 40257283,
        sha256: "ad4a1802485d8b34c722d2a9d04249662f2ece5d28a7a039063ca22f515a789e"
    } ]
};

export const TRANSCRIPTION_MODELS = [ RECOGNIZER_MODEL, VAD_MODEL, SPEAKER_MODEL ];

/**
 * Returns where the installed models are, or `null` while the recognizer or the VAD is missing.
 * Without the speaker model, the transcript labels no speakers.
 */
export function getModelPaths(): ModelPaths | null {
    const recognizer = resources.getPath(RECOGNIZER_MODEL.id);
    const vad = resources.getPath(VAD_MODEL.id);
    const speaker = resources.getPath(SPEAKER_MODEL.id);
    if (!recognizer || !vad) {
        return null;
    }
    return {
        recognizer,
        vad: path.join(vad, VAD_FILE),
        speaker: speaker ? path.join(speaker, SPEAKER_FILE) : null
    };
}
