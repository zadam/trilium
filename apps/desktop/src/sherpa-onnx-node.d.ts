declare module "sherpa-onnx-node" {
    export interface OnlineStream {
        acceptWaveform(wave: { samples: Float32Array; sampleRate: number }): void;
    }

    export class OnlineRecognizer {
        constructor(config: object);
        createStream(): OnlineStream;
        isReady(stream: OnlineStream): boolean;
        decode(stream: OnlineStream): void;
        isEndpoint(stream: OnlineStream): boolean;
        reset(stream: OnlineStream): void;
        getResult(stream: OnlineStream): { text: string };
    }
}
