import { describe, expect, it } from "vitest";

import { SpeakerClusterer } from "./speakers";

const options = { threshold: 0.5, minDurationSeconds: 1.5 };

describe("SpeakerClusterer", () => {
    it("joins similar embeddings and starts a speaker for a distant one", () => {
        const clusterer = new SpeakerClusterer(options);

        expect(clusterer.assign(new Float32Array([ 1, 0, 0 ]), 3)).toBe(1);
        // Scale does not matter, only direction.
        expect(clusterer.assign(new Float32Array([ 9, 1, 0 ]), 3)).toBe(1);
        expect(clusterer.assign(new Float32Array([ 0, 1, 0 ]), 3)).toBe(2);
        expect(clusterer.assign(new Float32Array([ 0.1, 1, 0 ]), 3)).toBe(2);
        expect(clusterer.assign(new Float32Array([ 0, 0, 1 ]), 3)).toBe(3);
    });

    it("takes a silent, all-zero embedding as a speaker of its own rather than dividing by zero", () => {
        const clusterer = new SpeakerClusterer(options);
        expect(clusterer.assign(new Float32Array([ 0, 0, 0 ]), 3)).toBe(1);
        expect(clusterer.assign(new Float32Array([ 1, 0, 0 ]), 3)).toBe(2);
    });

    it("lets a short utterance join a speaker but never start one or move a centroid", () => {
        const clusterer = new SpeakerClusterer(options);
        expect(clusterer.assign(new Float32Array([ 0, 1 ]), 1)).toBeNull();
        expect(clusterer.assign(new Float32Array([ 1, 0 ]), 3)).toBe(1);

        // Cosine 0.71 joins speaker 1; a centroid moved by it would let [0, 1] join too.
        expect(clusterer.assign(new Float32Array([ 1, 1 ]), 1)).toBe(1);
        expect(clusterer.assign(new Float32Array([ 0.2, 1 ]), 1)).toBeNull();
        expect(clusterer.assign(new Float32Array([ 0.2, 1 ]), 2)).toBe(2);
    });

    it("moves a centroid with every long utterance it takes", () => {
        const clusterer = new SpeakerClusterer(options);
        clusterer.assign(new Float32Array([ 1, 0 ]), 3);
        // Cosine 0.6 with [1, 0] joins, and pulls the centroid toward [0.6, 0.8].
        expect(clusterer.assign(new Float32Array([ 0.6, 0.8 ]), 3)).toBe(1);
        // Cosine 0.28 with [1, 0] alone; 0.68 with the moved centroid.
        expect(clusterer.assign(new Float32Array([ 0.28, 0.96 ]), 3)).toBe(1);
    });
});
