---
name: working-with-transcription
description: Use when working on Trilium's meeting transcription — the desktop pipeline in `apps/desktop/src/services/transcription/` (capture window, Silero VAD segmentation, Parakeet via sherpa-onnx-node, sinks and audio taps), the `transcript` attachment and its `TranscriptView`, the "Transcribe meeting" launcher, the standalone WebAssembly prototype, speaker detection (diarization), or any change to recognition quality — decoding method, beam search, hotwords, VAD settings, a different model. Includes replay.mjs, which transcribes a development recording again with changed settings, compare.mjs, which diffs two transcripts word by word with an error rate, and diarize.mjs, which labels a recording's speakers live and offline and times both. Don't judge an engine change by ear or from one live meeting; replay a recording and compare.
---

# Working with transcription

Desktop transcribes a meeting on the user's machine: no audio leaves it, and outside development builds none is kept. Standalone has only a prototype (`apps/standalone/transcription-poc/`, see its README).

## The pipeline

```
capture window (hidden, offscreen)          main process
  getUserMedia ─ microphone ─┐
  getDisplayMedia ─ system ──┴─ IPC "transcription-samples", 4096-sample Float32 chunks
                                   │
                         RecordingSession ── audio taps (dev: WavRecorder → *.wav)
                                   │
                  per source: SourcePipeline → VadSegmenter (Silero, 512-sample windows)
                                   │ utterances
                  one queue: recognizer.transcribe() (Parakeet TDT 0.6B v3 int8, libuv pool)
                                   │
                  sinks: AttachmentSink (transcript attachment), dev: TranscriptFileSink
                                   │
              state broadcast "transcription-state" (status, noteId, pendingSources)
```

| File | Owns |
|---|---|
| `apps/desktop/src/services/transcription/capture.ts` | The hidden capture window and its page; microphone and loopback system audio |
| `…/engine.ts` | `loadSherpaEngine()`: recognizer and VAD settings (`RECOGNIZER_SETTINGS`, `DECODING_METHOD`, `VAD_SETTINGS`), reported as `settings` |
| `…/session.ts` | `RecordingSession`: per-source segmentation, the decode queue, sinks, taps, pending sources |
| `…/attachment_sink.ts` | The `transcript` attachment, rewritten after every utterance |
| `…/audio_recorder.ts` | Development recordings: `WavRecorder`, `TranscriptFileSink`, `getRecordingDirectory()` |
| `…/index.ts` | IPC handlers, the state broadcast, which sinks and taps a recording gets |
| `packages/commons/src/lib/transcript.ts` | The `Transcript` format (`version: 1`, `startedAt`, `utterances`) |
| `apps/client/src/widgets/type_widgets/transcript/TranscriptView.tsx` | Turns, clock times, the "Speaking…" line, fade-in |
| `apps/client/src/widgets/launch_bar/RecordMeetingButton.tsx` | The launcher and `useTranscriptionState()` |

## The model

Both files go in `<data dir>/transcription-model`; for `pnpm desktop:start` that is `apps/desktop/data/transcription-model`.

- Parakeet: the `sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8` archive from the `asr-models` release of `k2-fsa/sherpa-onnx` — `encoder.int8.onnx`, `decoder.int8.onnx`, `joiner.int8.onnx`, `tokens.txt` (641 MB).
- `silero_vad.onnx` from the same release.

Without the directory, starting fails with `transcription.model-missing`.

## Development recordings

`pnpm desktop:start` (where `isDev()` holds) keeps every transcription in `apps/desktop/data/transcription-recordings/<created>_<noteId>/`:

| File | Holds |
|---|---|
| `microphone.wav`, `system.wav` | Mono 16 kHz 16-bit PCM, ~115 MB per hour each; the header is rewritten every chunk, so a crash leaves them playable |
| `recording.json` | `noteId`, `startedAt`, `sampleRate`, `engine` (the settings used), each source's `firstSampleOffsetMs` |
| `transcript.json` | The live transcript, in the attachment's format |
| `transcript.<label>.json` | Replays, written by `replay.mjs`, with a `replay` block (settings, hotwords, timings) |

There is no clean-up: delete directories by hand.

## Replaying a recording

```bash
S=.claude/skills/working-with-transcription
node $S/replay.mjs latest --label greedy                       # the baseline: recorded settings
node $S/replay.mjs latest --label beam4 \
    --set recognizer.decodingMethod=modified_beam_search --set recognizer.maxActivePaths=4
node $S/replay.mjs latest --label hot --hotwords "Trilium/Becca/Froca" \
    --set recognizer.decodingMethod=modified_beam_search
node $S/replay.mjs latest --label vad04 --set vad.threshold=0.4 --set vad.maxSpeechDuration=6
```

- `latest` is the newest development recording; any recording directory works too.
- It starts from `recording.json`'s `engine` and applies each `--set` (JSON-parsed when it parses). Recognizer keys sherpa-onnx reads from `modelConfig` (`modelType`, `numThreads`, `provider`, `modelingUnit`, `bpeVocab`) go there; the rest (`decodingMethod`, `maxActivePaths`, `hotwordsFile`, `hotwordsScore`, `blankPenalty`, `ruleFsts`, `ruleFars`) go top level.
- It runs in plain Node with the desktop app's `sherpa-onnx-node`, segments with Silero exactly as `VadSegmenter` does, and times each decode: RTF is decode time over audio length.
- `--source system` replays one source; `--force` replaces a label.

## Comparing transcripts

```bash
node $S/compare.mjs latest                    # list every transcript with its settings and RTF
node $S/compare.mjs latest greedy beam4       # word diff of beam4 against greedy
node $S/compare.mjs latest reference beam4    # beam4's word error rate against a corrected one
```

Per source it counts substitutions, deletions and insertions over the first transcript's words, and lists each difference with its time: `[-removed-] {+added+}`. Casing and punctuation are ignored unless `--strict`.

To measure accuracy rather than difference, make a reference: copy the baseline to `transcript.reference.json` and correct only the `text` fields by listening to the WAVs. `reference` always counts as the ground truth, whichever side it is given on.

## Speaker detection

Not in the app yet. `diarize.mjs` labels one source's utterances by speaker in two ways and times both:

- **live**: one embedding per utterance, in arrival order, joined to the closest speaker heard so far when the cosine similarity reaches `--threshold` (0.5), else a new speaker; utterances shorter than `--min-duration` (1.5 s) never start one. This is what can run during a meeting.
- **offline**: sherpa-onnx's `OfflineSpeakerDiarization` over the whole source (pyannote segmentation, embeddings, clustering), mapped onto the utterances by overlap; `+Dn` marks an utterance in which a second speaker talks ≥ 1 s.

```bash
node $S/diarize.mjs latest                                   # both, TitaNet, system source
node $S/diarize.mjs latest --mode offline --clusters 2       # when the speaker count is known
node $S/diarize.mjs latest --embedding campplus --threads 2
```

Models, in `<data dir>/transcription-model/speaker/`, from `k2-fsa/sherpa-onnx` releases:

- `nemo_en_titanet_small.onnx` (40 MB) and `3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx` (30 MB) from `speaker-recongition-models` (the tag is misspelled upstream);
- `segmentation.onnx` (6 MB): `model.onnx` of `sherpa-onnx-pyannote-segmentation-3-0.tar.bz2` from `speaker-segmentation-models`, renamed.

`SpeakerEmbeddingExtractor.compute()` and `OfflineSpeakerDiarization.process()` are **synchronous**, with no async variant: in the app they must not run on Electron's main thread (a worker thread, or the capture window).

Results on the first recording (two minutes, interviewer and curator on the system track, one thread):

| Method | Speakers found | Correct | Time for 117 s | CPU |
|---|---|---|---|---|
| live, TitaNet | 2 | Every single-speaker utterance; the other speaker scored 0.25 against 0.60–0.90 | 1.2 s (RTF 0.010), ~100 ms per utterance | ≈ wall |
| live, CAM++ | 4 | Split both speakers | 1.4 s | ≈ wall |
| offline, TitaNet, threshold 0.5 (default) | 6 | Over-split | 16.8 s (RTF 0.143) | ≈ wall |
| offline, TitaNet, threshold 1.0 or `--clusters 2` | 2 | As live, and flagged the 4 utterances where the interviewer cuts in | 20.7 s (RTF 0.177); 11.7 s on 2 threads | 20.6 s; 23.3 s on 2 threads |
| offline, CAM++, `--clusters 2` | 2 | Wrong split | 18.4 s | ≈ wall |

Two distinct voices on a clean recording are the easy case; similar voices, more speakers and call-quality audio are untested.

## Measuring a change

- **Compare against a replay, never against `transcript.json`.** The live recognizer decoded Float32 samples; a replay decodes the 16-bit WAV, and that rounding alone changed 4.1% of the words on the first recording with identical settings and identical segments. Replays of the same WAV are deterministic (0.0% between two runs), so the baseline is `replay.mjs --label greedy` with no overrides.
- **One recording is an anecdote.** Check a change on several, with both sources, a non-native speaker, and another language; Parakeet v3 handles 25.
- **A VAD change moves segment boundaries**, and the recognizer sees different context, so part of any difference is boundaries, not recognition.
- **Compare RTF only on one machine with nothing else running.** It was 0.125–0.127 for consecutive runs of one recording here; the PoC commit's ~0.03 came from a faster machine.
- **Check hotwords took effect**: they need `modified_beam_search` (with `greedy_search` sherpa ignores them without a word), and the replay's output must show no `Encode hotwords failed` line. With Parakeet's default settings, a hotword is looked up as a single entry of `tokens.txt`, so an ordinary word fails ("Cannot find ID for token androgynous"), and **one failing term drops the whole list** for that utterance. Encoding words into subword pieces needs `--set recognizer.modelingUnit=bpe --set recognizer.bpeVocab=<file>`, a vocabulary the Parakeet archive does not ship; it has to be exported from the NeMo tokenizer first.

## Findings so far

On the first recording (two minutes of system audio, English interview), against the `greedy` replay:

| Change | Words changed | RTF | Notes |
|---|---|---|---|
| `modified_beam_search`, 4 paths | 1.6% | 0.099 (greedy 0.127) | Faster, but all five changes were deletions of spoken words |
| Hotwords as plain words | 0% | — | Not applied: the terms did not encode (above) |

## Traps

- **Electron's V8 memory cage** rejects sherpa-onnx's external buffers: in the app, `vad.front(false)` (and `readWave(…, false)`). Plain Node, as in `replay.mjs`, does not need it.
- **Capture chunks must stay a multiple of 512 samples.** `VadSegmenter.accept()` feeds whole 512-sample windows and drops a remainder; 4096 divides evenly.
- **`maxSpeechDuration` is not a hard cut**: past it, sherpa lowers the minimum silence to 0.1 s and raises the threshold to 0.9, so a segment ends at the next short gap, typically 1–2 s later.
- **The capture window must be `offscreen`**: a hidden window renders no frames without it, and the self-capture that yields system audio times out. `getDisplayMedia()` needs a user gesture, which only `executeJavaScript(…, true)` gives a hidden window.
- **Chromium's audio processing is applied during capture**, so the WAV already holds it and no replay can switch it off. The system track runs with echo cancellation, noise suppression and auto gain all off; the microphone keeps echo cancellation, so the meeting played through speakers is not transcribed twice, and its auto gain. Earlier recordings, including the one under "Findings so far", had noise suppression on both tracks and echo cancellation on the system track, so do not compare transcripts across that change.
- **A silent system source** usually means the sink's monitor volume is near zero (seen at -66 dB); the per-source peak logged every 5 s shows it.
- **Prebuilds**: `sherpa-onnx-node` has none for win-arm64. `provider: "trt"` exits the process with an offline model.

## Tests

```bash
pnpm --filter @triliumnext/desktop test transcription
pnpm --filter @triliumnext/client test TranscriptView RecordMeetingButton
```

The desktop specs fake the engine and the capture; nothing loads the model. Changes to recognition quality are measured with the scripts above, not with specs.
