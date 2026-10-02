/** The id the host has in every collaboration's list of people. */
export const COLLAB_HOST_PERSON_ID = "host";

/** The longest name a person on a collaboration can have, in characters. */
export const MAX_COLLAB_NAME_LENGTH = 40;

/**
 * The colors of people's carets and initials. Each carries white text at 4.5:1 or more and stands
 * out at 3:1 or more on a dark page. The host has the first; guests take the others in turn.
 */
export const COLLAB_PERSON_COLORS = [
    "#2066df", "#d22a1e", "#127d3e", "#8f44e4", "#a55a18", "#12797d", "#cd1d84", "#717411"
] as const;

/** The name of each of {@link COLLAB_PERSON_COLORS}, in the same order, for its translation key. */
export const COLLAB_PERSON_COLOR_NAMES = [
    "blue", "red", "green", "purple", "orange", "teal", "magenta", "olive"
] as const;

/** Someone on a collaboration's pages, as each page and the host's app list them. */
export interface CollabPerson {
    /** {@link COLLAB_HOST_PERSON_ID} for the host; for a guest, an id that names no session. */
    id: string;
    name: string;
    /** One of {@link COLLAB_PERSON_COLORS}. */
    color: string;
    isHost: boolean;
    /** The note the person has open, or null while it is unknown. */
    noteId: string | null;
    /** Whether the person has that note open in an editor. */
    editing: boolean;
}

/** The person a shared selection belongs to. */
export type CollabCursorOwner = Pick<CollabPerson, "id" | "name" | "color">;

/**
 * A person's selection in a note, where equal ends are a caret. In a text note the ends are
 * CKEditor model paths in the `main` root; in a code note they are CodeMirror document offsets.
 * On a canvas it is the person's pointer, at a point of the Excalidraw scene.
 */
export type CollabSelection =
    | { kind: "text"; anchor: number[]; head: number[] }
    | { kind: "code"; anchor: number; head: number }
    | { kind: "canvas"; x: number; y: number };

/** The deepest model path a text selection can carry. */
const MAX_PATH_DEPTH = 16;
/** The largest offset a selection can carry, past the end of any note. */
const MAX_OFFSET = 100_000_000;
/** How far from the scene's origin a canvas pointer can be, in either direction. */
const MAX_CANVAS_COORDINATE = 10_000_000;

/**
 * Returns the value as a display name: trimmed, without control and formatting characters such as
 * direction overrides, each run of white space as one space, and cut to
 * {@link MAX_COLLAB_NAME_LENGTH} characters. Returns null when nothing is left.
 */
export function normalizeCollabName(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }

    const cleaned = value.replace(/\p{Cf}/gu, "").replace(/[\p{Cc}\s]+/gu, " ").trim();
    const name = [ ...cleaned ].slice(0, MAX_COLLAB_NAME_LENGTH).join("").trim();

    return name || null;
}

/**
 * Returns the value as one of {@link COLLAB_PERSON_COLORS}, whatever its letter case, or null for
 * any other value: a person's color only ever comes from the palette.
 */
export function normalizeCollabColor(value: unknown): string | null {
    const color = typeof value === "string" ? value.toLowerCase() : null;

    return COLLAB_PERSON_COLORS.find((candidate) => candidate === color) ?? null;
}

/**
 * Returns a copy of the value with only the fields of a selection, or null when it is not one: an
 * unknown kind, an end that is not a whole number in range, a path too deep, or a canvas point
 * that is not a finite number in range.
 */
export function parseCollabSelection(value: unknown): CollabSelection | null {
    if (typeof value !== "object" || value === null) {
        return null;
    }

    const { kind, anchor, head, x, y } = value as Record<string, unknown>;

    if (kind === "code" && isOffset(anchor) && isOffset(head)) {
        return { kind, anchor, head };
    }

    if (kind === "text" && isModelPath(anchor) && isModelPath(head)) {
        return { kind, anchor, head };
    }

    if (kind === "canvas" && isCanvasCoordinate(x) && isCanvasCoordinate(y)) {
        return { kind, x, y };
    }

    return null;
}

function isCanvasCoordinate(value: unknown): value is number {
    return typeof value === "number" && Number.isFinite(value)
        && Math.abs(value) <= MAX_CANVAS_COORDINATE;
}

function isOffset(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value) && value >= 0
        && value <= MAX_OFFSET;
}

function isModelPath(value: unknown): value is number[] {
    return Array.isArray(value) && value.length > 0 && value.length <= MAX_PATH_DEPTH
        && value.every(isOffset);
}
