export interface SpeakerClustererOptions {
    /** The cosine similarity to a speaker's centroid from which an utterance joins that speaker. */
    threshold: number;
    /** Utterances shorter than this, in seconds, never move a centroid. */
    minDurationSeconds: number;
    /** Only an utterance at least this long, in seconds, starts a speaker. */
    newSpeakerMinDurationSeconds: number;
    /**
     * The similarity from which an utterance shorter than `minDurationSeconds` joins the nearest
     * speaker when it is under `threshold`.
     */
    shortThreshold: number;
}

/**
 * Assigns embeddings to speakers as they arrive: an embedding joins the speaker whose centroid it
 * is most similar to, when that similarity reaches the threshold. Below it, an utterance of at
 * least `newSpeakerMinDurationSeconds` starts a new speaker, and a shorter one joins the nearest
 * speaker without moving its centroid, so a short or noisy utterance never adds a speaker.
 */
export class SpeakerClusterer {
    /** The sum of each speaker's normalized embeddings; its direction is the centroid. */
    private readonly centroids: Float32Array[] = [];

    constructor(private readonly options: SpeakerClustererOptions) {}

    assign(embedding: Float32Array, durationSeconds: number): number | null {
        const normalized = normalize(embedding);
        let best = -1;
        let bestSimilarity = -Infinity;
        for (const [ index, centroid ] of this.centroids.entries()) {
            const similarity = dot(normalize(centroid), normalized);
            if (similarity > bestSimilarity) {
                best = index;
                bestSimilarity = similarity;
            }
        }

        const isLongEnough = durationSeconds >= this.options.minDurationSeconds;
        if (best >= 0 && bestSimilarity >= this.options.threshold) {
            if (isLongEnough) {
                addInto(this.centroids[best], normalized);
            }
            return best + 1;
        }
        if (durationSeconds >= this.options.newSpeakerMinDurationSeconds) {
            this.centroids.push(normalized);
            return this.centroids.length;
        }
        if (best >= 0 && (isLongEnough || bestSimilarity >= this.options.shortThreshold)) {
            return best + 1;
        }
        return null;
    }
}

function normalize(vector: Float32Array) {
    let sumOfSquares = 0;
    for (const value of vector) {
        sumOfSquares += value * value;
    }
    const length = Math.sqrt(sumOfSquares) || 1;
    return vector.map((value) => value / length);
}

function dot(a: Float32Array, b: Float32Array) {
    let sum = 0;
    for (const [ index, value ] of a.entries()) {
        sum += value * b[index];
    }
    return sum;
}

function addInto(target: Float32Array, vector: Float32Array) {
    for (const [ index, value ] of vector.entries()) {
        target[index] += value;
    }
}
