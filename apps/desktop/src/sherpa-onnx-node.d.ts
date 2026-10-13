declare module "sherpa-onnx-node" {
    export interface OfflineStream {
        acceptWaveform(wave: { samples: Float32Array; sampleRate: number }): void;
    }

    export class OfflineRecognizer {
        static createAsync(config: object): Promise<OfflineRecognizer>;
        createStream(): OfflineStream;
        decodeAsync(stream: OfflineStream): Promise<{ text: string }>;
    }

    export class Vad {
        constructor(config: object, bufferSizeInSeconds: number);
        acceptWaveform(samples: Float32Array): void;
        isEmpty(): boolean;
        front(enableExternalBuffer: boolean): { start: number; samples: Float32Array };
        pop(): void;
    }
}
