// The page side of the prototype: the model catalog, the controls, clip decoding and microphone
// capture. Everything heavy happens in worker.js.
const HF = "https://huggingface.co";

/** The candidate models, pinned to a revision. `modelConfig` paths are where worker.js puts the files. */
const MODELS = [
    {
        id: "parakeet-tdt-0.6b-v3-int8",
        label: "Parakeet TDT 0.6B v3 (int8, 25 European languages)",
        repo: "csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
        revision: "2bda32ec70b097a55adaa07d9a7173915b43cc78",
        files: [
            [ "encoder.int8.onnx", 652184281 ],
            [ "decoder.int8.onnx", 11845275 ],
            [ "joiner.int8.onnx", 6355277 ],
            [ "tokens.txt", 93939 ]
        ],
        modelConfig: (dir) => ({
            transducer: {
                encoder: `${dir}/encoder.int8.onnx`,
                decoder: `${dir}/decoder.int8.onnx`,
                joiner: `${dir}/joiner.int8.onnx`
            },
            tokens: `${dir}/tokens.txt`,
            modelType: "nemo_transducer"
        })
    },
    {
        id: "sense-voice-int8-2025-09-09",
        label: "SenseVoice Small (int8, zh/en/ja/ko/yue)",
        repo: "csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-int8-2025-09-09",
        revision: "355f4d4884d8afd08aef04b9007a8556d7b463b2",
        files: [
            [ "model.int8.onnx", 237115547 ],
            [ "tokens.txt", 315894 ]
        ],
        modelConfig: (dir) => ({
            senseVoice: { model: `${dir}/model.int8.onnx`, language: "auto", useInverseTextNormalization: 1 },
            tokens: `${dir}/tokens.txt`
        })
    },
    {
        id: "moonshine-base-en-int8",
        label: "Moonshine base (int8, English)",
        repo: "csukuangfj/sherpa-onnx-moonshine-base-en-int8",
        revision: "052b0798ad1bf046a140fdd4efcd9426530fa3f5",
        files: [
            [ "preprocess.onnx", 14077290 ],
            [ "encode.int8.onnx", 50311494 ],
            [ "uncached_decode.int8.onnx", 122120451 ],
            [ "cached_decode.int8.onnx", 99983837 ],
            [ "tokens.txt", 436688 ]
        ],
        modelConfig: (dir) => ({
            moonshine: {
                preprocessor: `${dir}/preprocess.onnx`,
                encoder: `${dir}/encode.int8.onnx`,
                uncachedDecoder: `${dir}/uncached_decode.int8.onnx`,
                cachedDecoder: `${dir}/cached_decode.int8.onnx`
            },
            tokens: `${dir}/tokens.txt`
        })
    }
];

const CLIPS = [
    [ "English, 17 s", `${HF}/csukuangfj/sherpa-onnx-moonshine-base-en-int8/resolve/052b0798ad1bf046a140fdd4efcd9426530fa3f5/test_wavs/1.wav` ],
    [ "French, 7 s", `${HF}/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3/resolve/1a468a35cbba69418f126de829e75261dea4a4e4/test_wavs/fr.wav` ],
    [ "German, 4 s", `${HF}/csukuangfj/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3/resolve/1a468a35cbba69418f126de829e75261dea4a4e4/test_wavs/de.wav` ]
];

const $ = (id) => document.getElementById(id);
const worker = new Worker("worker.js");
let microphone = null;

for (const model of MODELS) {
    $("model").append(new Option(model.label, model.id));
}
for (const [ label ] of CLIPS) {
    $("clip").append(new Option(label, label));
}

worker.onmessage = ({ data }) => {
    switch (data.type) {
        case "ready": return log(`Runtime ready, WebAssembly memory ${data.heap} MiB. ${environment()}`);
        case "progress": return showProgress(data);
        case "downloaded": return void reportPersistence();
        case "loaded": return log(`Loaded ${data.model}: copy into MEMFS ${ms(data.timings.copyToMemfsMs)}, create recognizer ${ms(data.timings.createRecognizerMs)}, WebAssembly memory ${data.heapAfterLoad} MiB.`);
        case "result": return log(`${data.label}: ${ms(data.ms)} for ${ms(data.audioMs)} of audio (RTF ${data.rtf.toFixed(2)}), memory ${data.heap} MiB\n  → ${data.text}`);
        case "utterance": return log(`[${ms(data.offsetMs)}] ${data.text}\n  (${ms(data.ms)} for ${ms(data.audioMs)}, RTF ${data.rtf.toFixed(2)}, lag ${ms(data.lagMs)})`);
        case "live-started": return log("Listening.");
        case "live-stopped": return log("Stopped listening.");
        case "deleted": return log(`Deleted ${data.model} from OPFS.`);
        case "log": return console.debug(data.text);
        case "error": return log(`Error: ${data.message}`);
    }
};
worker.onerror = (e) => log(`Worker error: ${e.message}`);

$("download").onclick = () => worker.postMessage({ type: "download", model: selectedModel() });
$("load").onclick = () => {
    log("Loading…");
    worker.postMessage({ type: "load", model: selectedModel() });
};
$("delete").onclick = () => worker.postMessage({ type: "delete", model: selectedModel() });
$("transcribe").onclick = async () => {
    const [ label, url ] = CLIPS.find(([ clipLabel ]) => clipLabel === $("clip").value) ?? CLIPS[0];
    const samples = await decodeClip(url);
    worker.postMessage({ type: "transcribe", label, samples }, [ samples.buffer ]);
};
$("listen").onclick = async () => {
    if (microphone) {
        microphone.stop();
        microphone = null;
        worker.postMessage({ type: "live-stop" });
        $("listen").textContent = "Listen to the microphone";
        return;
    }
    worker.postMessage({ type: "live-start" });
    microphone = await captureMicrophone((samples) =>
        worker.postMessage({ type: "samples", samples }, [ samples.buffer ]));
    $("listen").textContent = "Stop listening";
};

/** Asks the browser not to evict the models under storage pressure. Only the page can ask. */
async function reportPersistence() {
    const persisted = await navigator.storage.persist();
    const { usage, quota } = await navigator.storage.estimate();
    log(`Downloaded. Persistent storage: ${persisted}, using ${(usage / 1048576).toFixed(0)} of ${(quota / 1048576).toFixed(0)} MiB.`);
}

function selectedModel() {
    const model = MODELS.find(({ id }) => id === $("model").value) ?? MODELS[0];
    return {
        id: model.id,
        files: model.files.map(([ name, size ]) => ({ name, size, url: `${HF}/${model.repo}/resolve/${model.revision}/${name}` })),
        modelConfig: model.modelConfig(`/models/${model.id}`)
    };
}

/** Decodes and resamples a clip to mono 16 kHz with the browser's own decoder. */
async function decodeClip(url) {
    const bytes = await (await fetch(url)).arrayBuffer();
    const context = new AudioContext({ sampleRate: 16000 });
    try {
        return (await context.decodeAudioData(bytes)).getChannelData(0).slice();
    } finally {
        await context.close();
    }
}

async function captureMicrophone(onSamples) {
    const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
    const context = new AudioContext({ sampleRate: 16000 });
    const processor = context.createScriptProcessor(4096, 1, 1);
    processor.onaudioprocess = (e) => onSamples(e.inputBuffer.getChannelData(0).slice());
    context.createMediaStreamSource(media).connect(processor);
    processor.connect(context.destination);
    return {
        stop() {
            for (const track of media.getTracks()) {
                track.stop();
            }
            void context.close();
        }
    };
}

function showProgress({ file, loaded, total, cached, ms: took }) {
    const percent = Math.round(loaded / total * 100);
    $("progress").textContent = cached
        ? `${file}: already in OPFS`
        : `${file}: ${(loaded / 1048576).toFixed(0)} / ${(total / 1048576).toFixed(0)} MiB (${percent}%)`;
    if (took) {
        log(`${file}: ${(total / 1048576).toFixed(0)} MiB in ${ms(took)}`);
    }
}

function environment() {
    return `crossOriginIsolated=${self.crossOriginIsolated}, cores=${navigator.hardwareConcurrency}, ${navigator.userAgent}`;
}

function ms(value) {
    return value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`;
}

function log(text) {
    $("log").textContent += `${new Date().toLocaleTimeString()}  ${text}\n`;
    console.log(text);
}
