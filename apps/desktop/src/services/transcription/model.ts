import { TRANSCRIPTION_MODEL_RESOURCE_ID } from "@triliumnext/commons";
import dataDirs from "@triliumnext/server/src/services/data_dir.js";
import type { ResourceDefinition } from "@triliumnext/server/src/services/resources.js";
import fs from "fs";
import { t } from "i18next";
import path from "path";

/**
 * A model directory installed by hand, which takes precedence over the downloaded one: it can
 * hold the full-precision Parakeet model, which `loadSherpaEngine()` prefers.
 */
export const LOCAL_MODEL_DIR = path.join(dataDirs.TRILIUM_DATA_DIR, "transcription-model");

const PARAKEET = "https://huggingface.co/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8/resolve/2bda32ec70b097a55adaa07d9a7173915b43cc78";
const SHERPA_RELEASES = "https://github.com/k2-fsa/sherpa-onnx/releases/download";

/** The files `loadSherpaEngine()` reads from its model directory, with the int8 Parakeet model. */
export const TRANSCRIPTION_MODEL: ResourceDefinition = {
    id: TRANSCRIPTION_MODEL_RESOURCE_ID,
    version: "parakeet-v3-int8-1",
    title: () => t("transcription.model-title"),
    description: () => t("transcription.model-description"),
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
        },
        {
            path: "silero_vad.onnx",
            url: `${SHERPA_RELEASES}/asr-models/silero_vad.onnx`,
            size: 643854,
            sha256: "9e2449e1087496d8d4caba907f23e0bd3f78d91fa552479bb9c23ac09cbb1fd6"
        },
        {
            path: "speaker/nemo_en_titanet_small.onnx",
            url: `${SHERPA_RELEASES}/speaker-recongition-models/nemo_en_titanet_small.onnx`,
            size: 40257283,
            sha256: "ad4a1802485d8b34c722d2a9d04249662f2ece5d28a7a039063ca22f515a789e"
        }
    ]
};
