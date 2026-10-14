declare module "sherpa-onnx-node" {
    export interface OfflineStream {
        acceptWaveform(wave: { samples: Float32Array; sampleRate: number }): void;
    }

    export class OfflineRecognizer {
        static createAsync(config: object): Promise<OfflineRecognizer>;
        createStream(): OfflineStream;
        decodeAsync(stream: OfflineStream): Promise<{ text: string }>;
    }

    export interface SpeakerEmbeddingStream {
        acceptWaveform(wave: { samples: Float32Array; sampleRate: number }): void;
        inputFinished(): void;
    }

    export class SpeakerEmbeddingExtractor {
        constructor(config: object);
        createStream(): SpeakerEmbeddingStream;
        isReady(stream: SpeakerEmbeddingStream): boolean;
        compute(stream: SpeakerEmbeddingStream, enableExternalBuffer: boolean): Float32Array;
    }

    export class Vad {
        constructor(config: object, bufferSizeInSeconds: number);
        acceptWaveform(samples: Float32Array): void;
        isEmpty(): boolean;
        isDetected(): boolean;
        front(enableExternalBuffer: boolean): { start: number; samples: Float32Array };
        pop(): void;
        flush(): void;
    }
}
